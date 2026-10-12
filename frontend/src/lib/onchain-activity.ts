import { ethers } from "ethers";
import { MONAD_CONTRACTS } from "./contracts";
import type { TransactionActivity } from "./activity-store";

const EXPLORER = "https://testnet.monadvision.com";
const AGENT_NAMES: Record<number, string> = {
  1: "Smart Contract Auditor",
  2: "Token Risk Scorer",
  3: "Gas Price & Timing Agent",
  4: "Whale & Liquidity Sentinel"
};

const iface = new ethers.Interface([
  "event FeedbackSubmitted(uint256 indexed agentId, address indexed reviewer, bytes32 indexed callId, uint8 kind, uint8 score, string note)",
  "event PaidCallRecorded(uint256 indexed agentId, address indexed client, bytes32 indexed callId)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, address indexed payee, string skill, string name, uint256 priceUSDC, string endpoint, string metadataURI)",
  "event CredentialIssued(uint256 indexed tokenId, address indexed learner, string learnerName, uint256 completedAt, string tokenURI)"
]);

/**
 * Reads the marketplace's real contract events from Monad Testnet for the last `blocks` blocks.
 * Monad's public RPC caps eth_getLogs at 100 blocks, so the window is scanned in parallel chunks.
 */
export async function fetchOnchainActivity(blocks = 3000): Promise<{ items: TransactionActivity[]; fromBlock: number; toBlock: number }> {
  const provider = new ethers.JsonRpcProvider(MONAD_CONTRACTS.rpcUrl, 10143, { staticNetwork: true });
  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - blocks + 1);
  const address = [MONAD_CONTRACTS.reputationRegistry, MONAD_CONTRACTS.identityRegistry, MONAD_CONTRACTS.academyCredential];

  const ranges: [number, number][] = [];
  for (let s = fromBlock; s <= latest; s += 100) ranges.push([s, Math.min(latest, s + 99)]);

  const logs: ethers.Log[] = [];
  for (let i = 0; i < ranges.length; i += 6) {
    const batch = await Promise.allSettled(ranges.slice(i, i + 6).map(([a, b]) => provider.getLogs({ address, fromBlock: a, toBlock: b })));
    for (const r of batch) if (r.status === "fulfilled") logs.push(...r.value);
  }

  // One timestamp lookup per distinct block (capped to keep the RPC load sane)
  const blockNums = Array.from(new Set(logs.map((l) => l.blockNumber))).slice(-60);
  const stamps = new Map<number, number>();
  await Promise.all(
    blockNums.map(async (n) => {
      const b = await provider.getBlock(n).catch(() => null);
      if (b) stamps.set(n, b.timestamp);
    })
  );

  const items: TransactionActivity[] = [];
  for (const log of logs) {
    let parsed: ethers.LogDescription | null = null;
    try {
      parsed = iface.parseLog(log);
    } catch {}
    if (!parsed) continue;

    const ts = stamps.get(log.blockNumber);
    const base = {
      id: `chain_${log.transactionHash}_${log.index}`,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      timestamp: ts ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
      status: "confirmed" as const,
      to: log.address,
      explorerUrl: `${EXPLORER}/tx/${log.transactionHash}`,
      monadscanUrl: `https://testnet.monadscan.com/tx/${log.transactionHash}`,
      network: "Monad Testnet" as const,
      chainId: 10143 as const
    };
    const a = parsed.args;

    if (parsed.name === "FeedbackSubmitted") {
      const id = Number(a.agentId);
      const kind = Number(a.kind) === 0 ? "Independent" : "Operator";
      items.push({
        ...base,
        type: "reputation_feedback",
        title: `${kind} review · ${AGENT_NAMES[id] || `Agent #${id}`}`,
        description: `Scored ${a.score}/100${a.note ? ` — ${a.note}` : ""} (call ${String(a.callId).slice(0, 10)}…)`,
        from: a.reviewer,
        contractName: "ReputationRegistryV2",
        agentId: id,
        agentName: AGENT_NAMES[id],
        metadata: { scoreGiven: Number(a.score), note: a.note, reviewerKind: kind, callId: a.callId, source: "onchain event" }
      });
    } else if (parsed.name === "PaidCallRecorded") {
      const id = Number(a.agentId);
      items.push({
        ...base,
        type: "x402_payment",
        title: `x402 paid call recorded · ${AGENT_NAMES[id] || `Agent #${id}`}`,
        description: `Paid call ${String(a.callId).slice(0, 10)}… recorded for client ${a.client}.`,
        from: a.client,
        contractName: "ReputationRegistryV2",
        agentId: id,
        agentName: AGENT_NAMES[id],
        metadata: { callId: a.callId, source: "onchain event" }
      });
    } else if (parsed.name === "AgentRegistered") {
      items.push({
        ...base,
        type: "agent_registration",
        title: `Agent registered · ${a.name}`,
        description: `${a.skill} at ${a.endpoint}, ${(Number(a.priceUSDC) / 1e6).toFixed(3)} USDC per call, paid to ${a.payee}.`,
        from: a.owner,
        contractName: "IdentityRegistryV2",
        agentId: Number(a.agentId),
        agentName: a.name,
        skill: a.skill,
        metadata: { source: "onchain event" }
      });
    } else if (parsed.name === "CredentialIssued") {
      items.push({
        ...base,
        type: "soulbound_credential",
        title: `Soulbound credential #${a.tokenId} issued`,
        description: `Monad Scholar credential issued to ${a.learnerName} (${a.learner}).`,
        from: a.learner,
        contractName: "AcademyCredential",
        metadata: { tokenId: a.tokenId.toString(), learner: a.learnerName, source: "onchain event" }
      });
    }
  }

  items.sort((x, y) => (y.blockNumber || 0) - (x.blockNumber || 0));
  return { items, fromBlock, toBlock: latest };
}
