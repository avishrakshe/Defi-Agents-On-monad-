import { ethers } from "ethers";
import { getContractBytecode } from "../shared/monadRpc";
import { disassemble, matchGroup, resolveProxy, decodeAbiString, ethCall, getLogsChunked, TRANSFER_TOPIC, OP } from "../shared/evm";

export interface ScoreFactor {
  factor: string;
  impact: number; // negative = deduction
  detail: string;
}

export interface TokenRiskResult {
  tokenAddress: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: string;
  isProxy: boolean;
  implementation?: string;
  proxyAdmin?: string;
  hasOwner: boolean;
  ownerAddress?: string;
  hasMintCapability: boolean;
  hasPauseCapability: boolean;
  hasBlacklistCapability: boolean;
  hasFeeControls: boolean;
  isPaused?: boolean;
  privilegedFunctions: string[];
  holderCountEstimate: number;
  topHolderSharePct?: number;
  transfersScanned: number;
  blocksScanned: number;
  score: number; // 0 (extreme risk) to 100 (safe)
  riskTier: "Low" | "Medium" | "High" | "Critical";
  breakdown: ScoreFactor[];
  explanation: string;
  flags: string[];
  knownAsset?: string;
  timestamp: string;
}

// Assets with a known issuer — their admin controls are expected, so we say so rather than hide them
const KNOWN_ASSETS: Record<string, string> = {
  "0x534b2f3a21130d7a60830c2df862319e593943a3": "Circle USDC (testnet) — centrally issued stablecoin; mint/pause/blacklist are issuer compliance controls."
};

const SCAN_BLOCKS = 3000; // ≈ 16 minutes of Monad blocks at ~0.33s

export async function scoreTokenRisk(tokenAddress: string): Promise<TokenRiskResult> {
  const address = ethers.getAddress(tokenAddress);
  const flags: string[] = [];
  const breakdown: ScoreFactor[] = [];
  const deduct = (factor: string, impact: number, detail: string) => {
    breakdown.push({ factor, impact: -impact, detail });
    flags.push(detail);
  };

  // 1. Bytecode + proxy resolution
  const bytecode = await getContractBytecode(address);
  if (!bytecode || bytecode === "0x") {
    return {
      tokenAddress: address,
      isProxy: false,
      hasOwner: false,
      hasMintCapability: false,
      hasPauseCapability: false,
      hasBlacklistCapability: false,
      hasFeeControls: false,
      privilegedFunctions: [],
      holderCountEstimate: 0,
      transfersScanned: 0,
      blocksScanned: 0,
      score: 0,
      riskTier: "Critical",
      breakdown: [{ factor: "No contract", impact: -100, detail: "No bytecode at this address" }],
      explanation: "No contract is deployed at this address on Monad Testnet (EOA or empty account) — it cannot be an ERC-20 token.",
      flags: ["NO_BYTECODE_DEPLOYED"],
      timestamp: new Date().toISOString()
    };
  }

  const proxy = await resolveProxy(address, bytecode);
  const logicCode = proxy.implementation ? await getContractBytecode(proxy.implementation) : bytecode;
  const dis = disassemble(logicCode);

  // 2. ERC-20 metadata (proper ABI decoding)
  const [nameRaw, symbolRaw, decRaw, supplyRaw, ownerRaw, pausedRaw] = await Promise.all([
    ethCall(address, "0x06fdde03"),
    ethCall(address, "0x95d89b41"),
    ethCall(address, "0x313ce567"),
    ethCall(address, "0x18160ddd"),
    ethCall(address, "0x8da5cb5b"),
    ethCall(address, "0x5c975abb")
  ]);
  const name = decodeAbiString(nameRaw);
  const symbol = decodeAbiString(symbolRaw);
  const decimals = decRaw && decRaw !== "0x" ? Number(BigInt(decRaw)) : 18;
  const totalSupplyRaw = supplyRaw && supplyRaw !== "0x" ? BigInt(supplyRaw) : undefined;
  const totalSupply = totalSupplyRaw !== undefined ? Number(ethers.formatUnits(totalSupplyRaw, decimals)).toLocaleString("en-US", { maximumFractionDigits: 2 }) : undefined;
  const isPaused = pausedRaw && pausedRaw !== "0x" ? BigInt(pausedRaw) === 1n : undefined;

  if (!name && !symbol && totalSupplyRaw === undefined) {
    deduct("Not ERC-20", 40, "Contract does not respond to name()/symbol()/totalSupply() — not a standard ERC-20 token.");
  }

  // 3. Ownership
  let hasOwner = false;
  let ownerAddress: string | undefined;
  if (ownerRaw && ownerRaw.length >= 66) {
    const o = ethers.getAddress("0x" + ownerRaw.slice(-40));
    if (o !== ethers.ZeroAddress) {
      hasOwner = true;
      ownerAddress = o;
      const ownerCode = await getContractBytecode(o).catch(() => "0x");
      const isContractOwner = ownerCode && ownerCode !== "0x";
      deduct(
        "Active owner",
        isContractOwner ? 5 : 10,
        `Owner ${o} ${isContractOwner ? "(a contract — possibly multisig/timelock)" : "(an externally owned account)"} retains privileged control.`
      );
    } else {
      breakdown.push({ factor: "Ownership renounced", impact: 0, detail: "owner() returns the zero address." });
      flags.push("Ownership renounced (owner = 0x0).");
    }
  }

  // 4. Upgradeability
  if (proxy.isProxy) {
    deduct("Upgradeable proxy", 10, `${proxy.standard} proxy → implementation ${proxy.implementation}. Logic can be replaced${proxy.admin ? ` by admin ${proxy.admin}` : ""}.`);
  }

  // 5. Privileged functions found in the real dispatch table
  const mint = matchGroup(dis.selectors, "mint");
  const pause = matchGroup(dis.selectors, "pause");
  const blacklist = matchGroup(dis.selectors, "blacklist");
  const fee = matchGroup(dis.selectors, "fee");
  const kill = matchGroup(dis.selectors, "selfdestruct");

  if (mint.length) deduct("Mintable supply", 20, `Supply can be expanded via ${mint.join(", ")}.`);
  if (pause.length) deduct("Pausable", 10, `Transfers can be frozen via ${pause.filter((s) => s !== "paused()").join(", ") || "pause()"}.`);
  if (isPaused) deduct("Currently paused", 30, "Token is PAUSED right now — transfers are halted.");
  if (blacklist.length) deduct("Blacklist", 15, `Individual wallets can be blocked via ${blacklist.join(", ")}.`);
  if (fee.length) deduct("Fee / trading controls", 20, `Owner-tunable fee or trading switches: ${fee.join(", ")} (common honeypot lever).`);
  if (kill.length || dis.opcodeCounts.has(OP.SELFDESTRUCT)) deduct("Self-destruct", 25, "Contract contains SELFDESTRUCT — it can be destroyed.");

  // 6. Holder distribution from real Transfer logs
  let holderCountEstimate = 0;
  let topHolderSharePct: number | undefined;
  let transfersScanned = 0;
  let blocksScanned = 0;
  try {
    const { logs, fromBlock, toBlock } = await getLogsChunked({ address, topics: [TRANSFER_TOPIC] }, SCAN_BLOCKS);
    blocksScanned = toBlock - fromBlock + 1;
    transfersScanned = logs.length;
    const received = new Map<string, bigint>();
    for (const log of logs) {
      if (!log.topics?.[2]) continue;
      const to = "0x" + log.topics[2].slice(26);
      const value = log.data && log.data !== "0x" ? BigInt(log.data) : 0n;
      received.set(to, (received.get(to) || 0n) + value);
    }
    holderCountEstimate = received.size;
    const total = [...received.values()].reduce((a, b) => a + b, 0n);
    if (total > 0n) {
      const top = [...received.values()].sort((a, b) => (b > a ? 1 : -1))[0];
      topHolderSharePct = Number((top * 10000n) / total) / 100;
    }

    if (transfersScanned === 0) {
      deduct("No recent activity", 5, `No transfers in the last ${blocksScanned.toLocaleString()} blocks (~${Math.round(blocksScanned * 0.33 / 60)} min).`);
    } else if (topHolderSharePct !== undefined && topHolderSharePct > 50 && holderCountEstimate > 1) {
      deduct("Flow concentration", 10, `${topHolderSharePct}% of recent transfer volume went to a single address.`);
    } else {
      flags.push(`${transfersScanned} transfers to ${holderCountEstimate} distinct recipients in the last ${blocksScanned.toLocaleString()} blocks.`);
    }
  } catch {
    flags.push("Transfer log scan unavailable (RPC limit or timeout).");
  }

  const score = Math.max(0, Math.min(100, 100 + breakdown.reduce((s, f) => s + f.impact, 0)));
  const riskTier = score >= 75 ? "Low" : score >= 50 ? "Medium" : score >= 25 ? "High" : "Critical";
  const knownAsset = KNOWN_ASSETS[address.toLowerCase()];

  const label = symbol ? `${name ?? symbol} (${symbol})` : address;
  const controls = [mint.length && "mint", pause.length && "pause", blacklist.length && "blacklist", fee.length && "fee controls", proxy.isProxy && "upgradeable logic"].filter(Boolean);
  const explanation =
    `${label}: ${riskTier} risk (${score}/100). ` +
    (controls.length ? `Privileged controls: ${controls.join(", ")}. ` : "No privileged supply/transfer controls found in the bytecode. ") +
    (hasOwner ? `Owner ${ownerAddress!.slice(0, 10)}… is active. ` : "") +
    (transfersScanned ? `${transfersScanned} recent transfers to ${holderCountEstimate} recipients.` : "No recent transfer activity.") +
    (knownAsset ? ` Note: ${knownAsset}` : "");

  return {
    tokenAddress: address,
    name,
    symbol,
    decimals,
    totalSupply,
    isProxy: proxy.isProxy,
    implementation: proxy.implementation,
    proxyAdmin: proxy.admin,
    hasOwner,
    ownerAddress,
    hasMintCapability: mint.length > 0,
    hasPauseCapability: pause.length > 0,
    hasBlacklistCapability: blacklist.length > 0,
    hasFeeControls: fee.length > 0,
    isPaused,
    privilegedFunctions: [...mint, ...pause, ...blacklist, ...fee, ...kill],
    holderCountEstimate,
    topHolderSharePct,
    transfersScanned,
    blocksScanned,
    score,
    riskTier,
    breakdown,
    explanation,
    flags,
    knownAsset,
    timestamp: new Date().toISOString()
  };
}
