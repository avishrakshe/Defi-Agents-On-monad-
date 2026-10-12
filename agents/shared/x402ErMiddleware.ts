import { Request, Response, NextFunction } from "express";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  coder,
  erExplorerUrl,
  mbConnections,
  mbEnv,
  mbPdas,
  pick,
  programId,
  resourceHash,
  SolanaAgent,
  solanaAgentForSkill
} from "./solanaMarket";
import { recordErConfirm } from "./mbMetrics";

/**
 * x402 over a MagicBlock Ephemeral Rollup ("er-tab" scheme), used when the request comes in on the MagicBlock rail.
 *
 * 1. No payment header → HTTP 402: price, the agent's payee and everything needed to build a pay_for_call tx.
 * 2. Payment header = base64 serialized transaction with exactly one agent_market.pay_for_call, signed by the client.
 *    We check program, agent_id, amount ≥ price, resource_hash = sha256(method + path + body) of THIS request,
 *    signatures and a fresh ER blockhash — then submit it to the pinned ER and wait for confirmation.
 * 3. Only a confirmed ER payment reaches the handler. There is no "serve anyway" path on this rail.
 */
export interface ErSettlementReceipt {
  scheme: "er-tab";
  network: "solana-devnet";
  settled: boolean;
  status: "settled";
  erSignature: string;
  confirmMs: number;
  receiptPda: string;
  explorerUrl: string;
  from: string;
  payTo: string;
  agentId: number;
  amountUnits: string;
  amount: string;
  callId: string;
  resourceHash: string;
  timestamp: string;
}

const label = (units: bigint) => `$${(Number(units) / 1e6).toFixed(3)}`;

export function createX402ErMiddleware(agentSkill: string, resourceUrl: string) {
  const requirements = (agent: SolanaAgent) => {
    const e = mbEnv();
    return {
      scheme: "er-tab",
      network: "solana-devnet",
      price: label(agent.priceUnits),
      maxAmountRequired: agent.priceUnits.toString(),
      asset: e.usdcMint,
      assetSymbol: "tUSDC",
      assetDecimals: 6,
      payTo: agent.payee,
      agentId: agent.id,
      resource: resourceUrl,
      description: `Pay-per-call access to the ${agentSkill} agent, settled on a MagicBlock Ephemeral Rollup`,
      extra: {
        programId: e.programId,
        router: e.routerUrl,
        erRpc: e.erRpc,
        validator: e.validator,
        resourceHash: "sha256(METHOD + path + JSON.stringify(body))"
      }
    };
  };
  const reject = (res: Response, agent: SolanaAgent, reason: string) =>
    res.status(402).json({ status: 402, error: "Payment Required", reason, x402: { version: "2", accepts: [requirements(agent)] } });

  return async function x402ErMiddleware(req: Request, res: Response, next: NextFunction) {
    let agent: SolanaAgent | undefined;
    try {
      agent = await solanaAgentForSkill(agentSkill);
    } catch (err: any) {
      return res.status(503).json({ error: "agent_market registry unreachable", details: err.message });
    }
    if (!agent) return res.status(503).json({ error: `No active agent_market agent for skill "${agentSkill}"` });

    const header = (req.headers["x-payment"] || req.headers["x-payment-authorization"]) as string | undefined;
    if (!header) {
      const e = mbEnv();
      res.set(
        "WWW-Authenticate",
        `x402 scheme="er-tab", network="solana-devnet", payTo="${agent.payee}", asset="${e.usdcMint}", price="${label(agent.priceUnits)}", agentId="${agent.id}"`
      );
      return reject(res, agent, "Missing X-Payment header");
    }

    // ---- Verify ----
    let tx: Transaction;
    try {
      tx = Transaction.from(Buffer.from(header.replace(/^x402 /, ""), "base64"));
    } catch {
      return reject(res, agent, "Payment header is not a base64 serialized Solana transaction");
    }
    if (tx.instructions.length !== 1) return reject(res, agent, "Payment tx must contain exactly one instruction");
    const ix = tx.instructions[0];
    if (!ix.programId.equals(programId())) return reject(res, agent, "Payment tx targets the wrong program");
    let decoded: any;
    try {
      decoded = coder.instruction.decode(ix.data);
    } catch {
      decoded = null;
    }
    if (!decoded || !/^pay_?for_?call$/i.test(decoded.name)) return reject(res, agent, "Payment tx is not pay_for_call");
    const d = decoded.data;
    const agentId = Number(pick(d, "agent_id").toString());
    const amount = BigInt(d.amount.toString());
    const hash = Buffer.from(pick(d, "resource_hash"));
    const callId = Buffer.from(pick(d, "call_id"));
    if (agentId !== agent.id) return reject(res, agent, `pay_for_call is for agent #${agentId}, this is agent #${agent.id}`);
    if (amount < agent.priceUnits) return reject(res, agent, `Amount ${amount} below price ${agent.priceUnits}`);
    const path = req.originalUrl.split("?")[0];
    if (!hash.equals(resourceHash(req.method, path, req.body))) return reject(res, agent, "resource_hash does not match this request");
    const client: PublicKey = ix.keys[0].pubkey;
    if (!tx.feePayer?.equals(client)) return reject(res, agent, "Fee payer must be the paying client");
    if (!tx.verifySignatures()) return reject(res, agent, "Missing or invalid client signature");

    const { er } = mbConnections();
    try {
      const fresh = await er.isBlockhashValid(tx.recentBlockhash!, { commitment: "confirmed" });
      if (!fresh.value) return reject(res, agent, "Transaction does not carry a fresh ER blockhash");
    } catch (err: any) {
      return reject(res, agent, `Could not check ER blockhash: ${err.message}`);
    }

    // ---- Settle on the ER ----
    let sig: string;
    let confirmMs: number;
    try {
      const raw = tx.serialize();
      const t0 = performance.now();
      sig = await er.sendRawTransaction(raw, { skipPreflight: true });
      const conf = await er.confirmTransaction(sig, "confirmed");
      confirmMs = Math.round(performance.now() - t0);
      if (conf.value.err) {
        const logs = (await er.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }).catch(() => null))?.meta?.logMessages || [];
        const why = logs.find((l) => /Error Message|AnchorError/.test(l)) || JSON.stringify(conf.value.err);
        return reject(res, agent, `ER settlement failed (${sig}): ${why}`);
      }
    } catch (err: any) {
      return reject(res, agent, `ER settlement failed: ${err.message}`);
    }
    recordErConfirm(confirmMs, sig);

    const receipt: ErSettlementReceipt = {
      scheme: "er-tab",
      network: "solana-devnet",
      settled: true,
      status: "settled",
      erSignature: sig,
      confirmMs,
      receiptPda: mbPdas.receipt(client, callId).toBase58(),
      explorerUrl: erExplorerUrl(sig),
      from: client.toBase58(),
      payTo: agent.payee,
      agentId: agent.id,
      amountUnits: amount.toString(),
      amount: `${label(amount)} tUSDC`,
      callId: callId.toString("hex"),
      resourceHash: hash.toString("hex"),
      timestamp: new Date().toISOString()
    };
    (req as any).x402Settlement = receipt;
    res.setHeader("X-Payment-Response", Buffer.from(JSON.stringify(receipt)).toString("base64"));
    next();
  };
}
