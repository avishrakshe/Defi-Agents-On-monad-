import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import { RegistryAgent, agentForSkill, identityAddress } from "./registry";

const priceLabel = (units: bigint) => `$${(Number(units) / 1e6).toFixed(3)}`;

/**
 * x402 "exact" scheme middleware for Monad Testnet, settling with EIP-3009.
 *
 * 1. No payment header            → HTTP 402 with the payment requirements (incl. the token's EIP-712 domain).
 * 2. Payment header present       → verify signature, payee, amount, validity window and nonce replay.
 * 3. Verified                     → submit USDC.transferWithAuthorization onchain (this server acts as its own
 *                                   facilitator/relayer and pays the MON gas) and attach the real receipt.
 *
 * If the payer cannot cover the amount, the request is still served (so the demo works on an unfunded wallet)
 * but the receipt says `settled: false` with the reason. Set X402_REQUIRE_SETTLEMENT=true to refuse instead.
 */

export interface SettlementReceipt {
  scheme: "exact";
  network: string;
  settled: boolean;
  status: "settled" | "unfunded" | "failed";
  signatureVerified: boolean;
  /** Real USDC transfer transaction — only present when the transfer was mined */
  txHash?: string;
  blockNumber?: number;
  explorerUrl?: string;
  reason?: string;
  from: string;
  payTo: string;
  agentId: number;
  amount: string;
  amountUnits: string;
  timestamp: string;
}

const USDC_ABI = [
  "function name() view returns (string)",
  "function version() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)"
];

const TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" }
  ]
};

const env = () => ({
  network: process.env.NEXT_PUBLIC_MONAD_NETWORK || "eip155:10143",
  chainId: Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || 10143),
  rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
  asset: process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3",
  explorer: process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://testnet.monadvision.com",
  relayerKey: process.env.SETTLEMENT_RELAYER_PRIVATE_KEY || process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY,
  requireSettlement: process.env.X402_REQUIRE_SETTLEMENT === "true"
});

let shared: { provider: ethers.JsonRpcProvider; usdc: ethers.Contract; relayer?: ethers.Signer } | null = null;
let domainCache: Promise<ethers.TypedDataDomain> | null = null;
// Serialises settlement txs so concurrent agents sharing one relayer key never collide on nonces
let settlementQueue: Promise<unknown> = Promise.resolve();

function chain() {
  if (!shared) {
    const e = env();
    const provider = new ethers.JsonRpcProvider(e.rpcUrl, e.chainId, { staticNetwork: true });
    const key = e.relayerKey && !e.relayerKey.includes("[") ? (e.relayerKey.startsWith("0x") ? e.relayerKey : `0x${e.relayerKey}`) : undefined;
    // Plain wallet (not NonceManager): the orchestrator process signs with the same key, so the
    // pending nonce must be re-read from chain for every send
    const relayer = key ? new ethers.Wallet(key, provider) : undefined;
    shared = { provider, usdc: new ethers.Contract(e.asset, USDC_ABI, provider), relayer };
  }
  return shared;
}

/** The token's real EIP-712 domain, read from chain (Circle testnet USDC uses name "USDC", version "2") */
export function getUsdcDomain(): Promise<ethers.TypedDataDomain> {
  if (!domainCache) {
    const e = env();
    const { usdc } = chain();
    domainCache = Promise.all([usdc.name().catch(() => "USDC"), usdc.version().catch(() => "2")]).then(([name, version]) => ({
      name,
      version,
      chainId: e.chainId,
      verifyingContract: e.asset
    }));
  }
  return domainCache;
}

/**
 * @param agentSkill skill slug this agent is registered under in IdentityRegistryV2; payee and price are read from
 *                   that registry record (cached 60s), so every agent is paid at its own address.
 */
export function createX402Middleware(agentSkill: string, resourceUrl: string) {
  const requirements = async (agent: RegistryAgent) => {
    const e = env();
    return {
      scheme: "exact",
      network: e.network,
      payTo: agent.payee,
      price: priceLabel(agent.priceUnits),
      maxAmountRequired: agent.priceUnits.toString(),
      asset: e.asset,
      assetDecimals: 6,
      symbol: "USDC",
      resource: resourceUrl,
      description: `Pay-per-call access to the ${agentSkill} agent`,
      maxTimeoutSeconds: 3600,
      extra: { eip712: await getUsdcDomain(), agentId: agent.id, identityRegistry: identityAddress() }
    };
  };

  const reject = async (res: Response, agent: RegistryAgent, reason: string) =>
    res.status(402).json({ status: 402, error: "Payment Required", reason, x402: { version: "2", accepts: [await requirements(agent)] } });

  return async function x402Middleware(req: Request, res: Response, next: NextFunction) {
    const e = env();
    const header = (req.headers["x-payment-authorization"] || req.headers["x-payment"]) as string | undefined;

    // Fail closed: without a registry record there is no payee to pay
    let agent: RegistryAgent | undefined;
    try {
      agent = await agentForSkill(agentSkill);
    } catch (err: any) {
      return res.status(503).json({ error: "IdentityRegistryV2 unreachable", details: err.shortMessage || err.message });
    }
    if (!agent) return res.status(503).json({ error: `No active agent registered for skill "${agentSkill}"` });
    const price = priceLabel(agent.priceUnits);
    const priceUnits = agent.priceUnits;

    if (!header) {
      res.set("WWW-Authenticate", `x402 scheme="exact", network="${e.network}", payTo="${agent.payee}", asset="${e.asset}", price="${price}"`);
      return reject(res, agent, "Missing X-Payment-Authorization header");
    }

    // Accept raw JSON, base64 JSON, or the x402 v2 { payload: { authorization, signature } } envelope
    let p: any;
    try {
      const raw = header.startsWith("x402 ") ? header.slice(5) : header;
      try {
        p = JSON.parse(raw);
      } catch {
        p = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
      }
      if (p?.payload?.authorization) p = { ...p.payload.authorization, signature: p.payload.signature };
    } catch {
      return reject(res, agent, "Malformed payment payload");
    }

    const missing = ["from", "to", "value", "validAfter", "validBefore", "nonce", "signature"].filter((k) => p?.[k] === undefined || p?.[k] === "");
    if (missing.length) return reject(res, agent, `Payment payload missing: ${missing.join(", ")}`);

    // ---- Verify ----
    let from: string;
    try {
      const domain = await getUsdcDomain();
      const message = {
        from: ethers.getAddress(p.from),
        to: ethers.getAddress(p.to),
        value: BigInt(p.value),
        validAfter: BigInt(p.validAfter),
        validBefore: BigInt(p.validBefore),
        nonce: p.nonce
      };
      const recovered = ethers.verifyTypedData(domain, TYPES, message, p.signature);
      if (recovered.toLowerCase() !== message.from.toLowerCase()) return reject(res, agent, "Signature does not match payer");
      if (message.to.toLowerCase() !== agent.payee.toLowerCase()) return reject(res, agent, `Payment must be addressed to this agent's payee ${agent.payee}`);
      if (message.value < priceUnits) return reject(res, agent, `Insufficient amount: ${price} required`);
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now <= message.validAfter || now >= message.validBefore) return reject(res, agent, "Authorization outside its validity window");
      const used = await chain().usdc.authorizationState(message.from, message.nonce).catch(() => false);
      if (used) return reject(res, agent, "Authorization nonce already used (replay)");
      from = message.from;
    } catch (err: any) {
      return reject(res, agent, `Invalid payment authorization: ${err.shortMessage || err.message}`);
    }

    // ---- Settle ----
    const receipt: SettlementReceipt = {
      scheme: "exact",
      network: e.network,
      settled: false,
      status: "failed",
      signatureVerified: true,
      from,
      payTo: agent.payee,
      agentId: agent.id,
      amount: `${price} USDC`,
      amountUnits: String(p.value),
      timestamp: new Date().toISOString()
    };

    const { usdc, relayer } = chain();
    try {
      const balance: bigint = await usdc.balanceOf(from);
      if (balance < BigInt(p.value)) {
        receipt.status = "unfunded";
        receipt.reason = `Payer holds ${ethers.formatUnits(balance, 6)} USDC — top up at https://faucet.circle.com (Monad Testnet) to settle onchain.`;
      } else if (!relayer) {
        receipt.reason = "No settlement relayer key configured";
      } else {
        const sig = ethers.Signature.from(p.signature);
        const run = async () => {
          const tx = await (usdc.connect(relayer) as ethers.Contract).transferWithAuthorization(
            from, p.to, p.value, p.validAfter, p.validBefore, p.nonce, sig.v, sig.r, sig.s
          );
          return tx.wait();
        };
        const mined = await (settlementQueue = settlementQueue.catch(() => undefined).then(run));
        const m = mined as ethers.TransactionReceipt;
        Object.assign(receipt, {
          settled: true,
          status: "settled",
          txHash: m.hash,
          blockNumber: m.blockNumber,
          explorerUrl: `${e.explorer}/tx/${m.hash}`
        });
      }
    } catch (err: any) {
      receipt.status = "failed";
      receipt.reason = err.shortMessage || err.message;
    }

    if (!receipt.settled && e.requireSettlement) {
      return reject(res, agent, `Settlement ${receipt.status}: ${receipt.reason}`);
    }

    (req as any).x402Settlement = receipt;
    res.setHeader("X-Payment-Response", Buffer.from(JSON.stringify(receipt)).toString("base64"));
    next();
  };
}
