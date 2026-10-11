import { ethers } from "ethers";

/**
 * Client side of x402 "exact": signs EIP-3009 TransferWithAuthorization payloads against the
 * token's real EIP-712 domain (read from chain — Circle's testnet USDC uses name "USDC", version "2").
 */

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

export const rpcUrl = () => process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
export const usdcAddress = () => process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3";

let provider: ethers.JsonRpcProvider | null = null;
export function getProvider() {
  if (!provider) provider = new ethers.JsonRpcProvider(rpcUrl(), 10143, { staticNetwork: true });
  return provider;
}

/** Orchestrator wallet, or null when no usable key is configured */
export function getOrchestratorWallet(): ethers.Wallet | null {
  const raw = process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!raw || raw.includes("[")) return null;
  try {
    return new ethers.Wallet(raw.startsWith("0x") ? raw : `0x${raw}`, getProvider());
  } catch {
    return null;
  }
}

let domain: Promise<ethers.TypedDataDomain> | null = null;
export function getUsdcDomain() {
  if (!domain) {
    const token = new ethers.Contract(usdcAddress(), ["function name() view returns (string)", "function version() view returns (string)"], getProvider());
    domain = Promise.all([token.name().catch(() => "USDC"), token.version().catch(() => "2")]).then(([name, version]) => ({
      name,
      version,
      chainId: 10143,
      verifyingContract: usdcAddress()
    }));
  }
  return domain;
}

export async function signPaymentAuthorization(wallet: ethers.Wallet, payTo: string, valueUnits = "1000") {
  const now = Math.floor(Date.now() / 1000);
  const message = {
    from: wallet.address,
    to: ethers.getAddress(payTo),
    value: valueUnits,
    validAfter: now - 60,
    validBefore: now + 3600,
    nonce: ethers.hexlify(ethers.randomBytes(32))
  };
  const signature = await wallet.signTypedData(await getUsdcDomain(), TYPES, message);
  return { scheme: "exact", network: "eip155:10143", ...message, signature };
}

export async function getBalances(address: string) {
  const p = getProvider();
  const usdc = new ethers.Contract(usdcAddress(), ["function balanceOf(address) view returns (uint256)"], p);
  const [mon, usd] = await Promise.all([p.getBalance(address), usdc.balanceOf(address)]);
  return { mon: ethers.formatEther(mon), usdc: ethers.formatUnits(usd, 6) };
}
