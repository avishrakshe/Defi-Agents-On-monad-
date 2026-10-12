import { ethers } from "ethers";

export interface ReviewSplit {
  avg: number;
  count: number;
}

export interface AgentData {
  id: number;
  name: string;
  skill: string;
  endpoint: string;
  priceUSDC: string;
  metadataURI: string;
  description: string;
  dataSource: string;
  /** null when the registry could not be read — never a placeholder */
  stakedUSDC: number | null;
  owner: string | null;
  payee: string | null;
  active: boolean;
  /** Reviews written by the paying client's own wallet */
  independent: ReviewSplit;
  /** Reviews written by the orchestrator for Mode A calls it paid for */
  operator: ReviewSplit;
  paidCalls: number | null;
  source: "chain" | "fallback";
}

/** Independent reviews needed before an agent is ranked by its independent score */
export const MIN_INDEPENDENT_REVIEWS = 3;

export const MONAD_CONTRACTS = {
  network: process.env.NEXT_PUBLIC_MONAD_NETWORK || "eip155:10143",
  chainId: 10143,
  rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
  usdc: process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3",
  identityRegistry: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "0xfdeEE314eb3235a91e00a4EFFb76982F6F96e0C6",
  reputationRegistry: process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "0x3A330F950E830f9e2DE8Dde90742D3459db6C54A",
  stakeManager: process.env.NEXT_PUBLIC_STAKE_MANAGER_ADDRESS || "0x498da2D83e2eC5b3D6FE2499B1dB17719E719da1",
  academyCredential: process.env.NEXT_PUBLIC_ACADEMY_CREDENTIAL_ADDRESS || "0xAbAFE53736e087877561cd0E48C283D6e7e59Ce6",
  explorer: "https://testnet.monadvision.com",
  faucet: "https://faucet.monad.xyz"
};

export const IDENTITY_V2_ABI = [
  "function getAllAgents() external view returns (tuple(uint256 id, address owner, address payee, string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, uint256 registeredAt, bool active)[])",
  "function registerAgent(string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, address payee) external returns (uint256)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, address indexed payee, string skill, string name, uint256 priceUSDC, string endpoint, string metadataURI)"
];

export const REPUTATION_V2_ABI = [
  "function getReputation(uint256 agentId) external view returns (uint256 avgAll, uint256 countAll, uint256 avgIndependent, uint256 countIndependent)",
  "function getOperatorReputation(uint256 agentId) external view returns (uint256 avgOperator, uint256 countOperator)",
  "function paidCallCount(uint256 agentId) external view returns (uint256)",
  "function submitFeedback(uint256 agentId, bytes32 callId, uint8 score, string note) external",
  "function getCall(bytes32 callId) external view returns (tuple(uint256 agentId, address client, uint64 recordedAt, bool reviewed))"
];

/**
 * Shown only when the registry can't be read. It carries descriptions, not facts: no owner, no stake, no reviews.
 */
const FALLBACK_AGENTS = [
  { name: "Smart Contract Auditor", skill: "contract-audit", description: "Static security analysis of verified Monad Testnet contracts." },
  { name: "Token Risk Scorer", skill: "token-risk-score", description: "Onchain inspection of ERC-20 tokens: owner privileges, mint/freeze backdoors, holder concentration." },
  { name: "Gas Price & Transaction Timing Agent", skill: "gas-timing", description: "Fee oracle over eth_feeHistory with a send-now / wait recommendation." },
  { name: "Whale & Liquidity Sentinel", skill: "whale-tracker", description: "Large MON or token moves, classified by where the size is flowing." }
];

const EMPTY: ReviewSplit = { avg: 0, count: 0 };

export async function fetchLiveAgents(): Promise<AgentData[]> {
  try {
    const provider = new ethers.JsonRpcProvider(MONAD_CONTRACTS.rpcUrl, 10143, { staticNetwork: true });
    const identity = new ethers.Contract(MONAD_CONTRACTS.identityRegistry, IDENTITY_V2_ABI, provider);
    const rep = new ethers.Contract(MONAD_CONTRACTS.reputationRegistry, REPUTATION_V2_ABI, provider);
    const stake = new ethers.Contract(MONAD_CONTRACTS.stakeManager, ["function getStake(uint256 agentId) external view returns (uint256)"], provider);

    const raw = await identity.getAllAgents();
    if (raw?.length) {
      return await Promise.all(
        raw.map(async (a: any) => {
          const id = Number(a.id);
          let meta: any = {};
          try {
            meta = JSON.parse(a.metadataURI);
          } catch {}
          const [stakeRaw, r, op, calls] = await Promise.all([
            stake.getStake(id).catch(() => null),
            rep.getReputation(id).catch(() => null),
            rep.getOperatorReputation(id).catch(() => null),
            rep.paidCallCount(id).catch(() => null)
          ]);
          return {
            id,
            name: a.name || meta.name || `Agent #${id}`,
            skill: a.skill,
            endpoint: a.endpoint,
            priceUSDC: `$${(Number(a.priceUSDC) / 1e6).toFixed(3)}`,
            metadataURI: a.metadataURI,
            description: meta.description || "",
            dataSource: meta.dataSource || "",
            stakedUSDC: stakeRaw === null ? null : Number(stakeRaw) / 1e6,
            owner: a.owner,
            payee: a.payee,
            active: a.active,
            independent: r ? { avg: Number(r[2]), count: Number(r[3]) } : EMPTY,
            operator: op ? { avg: Number(op[0]), count: Number(op[1]) } : EMPTY,
            paidCalls: calls === null ? null : Number(calls),
            source: "chain" as const
          };
        })
      );
    }
  } catch (err) {
    console.warn("Could not read IdentityRegistryV2:", err);
  }

  return FALLBACK_AGENTS.map((a, i) => ({
    id: i + 1,
    name: a.name,
    skill: a.skill,
    endpoint: "",
    priceUSDC: "$0.001",
    metadataURI: "",
    description: a.description,
    dataSource: "",
    stakedUSDC: null,
    owner: null,
    payee: null,
    active: true,
    independent: EMPTY,
    operator: EMPTY,
    paidCalls: null,
    source: "fallback" as const
  }));
}

/** Independent score once an agent has enough independent reviews, otherwise null */
export const rankedScore = (a: AgentData) => (a.independent.count >= MIN_INDEPENDENT_REVIEWS ? a.independent.avg : null);

/** Agents with a rankable independent score first (highest first), the rest in registry order */
export function sortByIndependentScore(agents: AgentData[]): AgentData[] {
  return [...agents].sort((x, y) => {
    const sx = rankedScore(x);
    const sy = rankedScore(y);
    if (sx !== null && sy !== null) return sy - sx || x.id - y.id;
    if (sx !== null) return -1;
    if (sy !== null) return 1;
    return x.id - y.id;
  });
}

export const shortAddr = (a: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
export const splitLabel = (s: ReviewSplit) => (s.count ? `${s.avg}/100 · ${s.count}` : "—");
