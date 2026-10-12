import { ethers } from "ethers";

/**
 * Reads IdentityRegistryV2 (cached 60s). Shared by the agents' x402 middleware (to find their own payee and price)
 * and by the orchestrator (to resolve a skill to its active agent id).
 *
 * AGENT_IDS="contract-audit:1,token-risk-score:2,gas-timing:3,whale-tracker:4" pins skills to ids.
 */

export interface RegistryAgent {
  id: number;
  owner: string;
  payee: string;
  name: string;
  skill: string;
  endpoint: string;
  priceUnits: bigint;
  metadataURI: string;
  active: boolean;
}

export const IDENTITY_V2_ABI = [
  "function getAllAgents() view returns (tuple(uint256 id, address owner, address payee, string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, uint256 registeredAt, bool active)[])",
  "function getAgent(uint256 agentId) view returns (tuple(uint256 id, address owner, address payee, string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, uint256 registeredAt, bool active))",
  "function registerAgent(string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, address payee) returns (uint256)",
  "function transferAgentOwnership(uint256 agentId, address newOwner)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, address indexed payee, string skill, string name, uint256 priceUSDC, string endpoint, string metadataURI)"
];

export const REPUTATION_V2_ABI = [
  "function recordPaidCall(uint256 agentId, address client, bytes32 callId)",
  "function submitFeedbackFor(uint256 agentId, bytes32 callId, uint8 score, string note)",
  "function getReputation(uint256 agentId) view returns (uint256 avgAll, uint256 countAll, uint256 avgIndependent, uint256 countIndependent)",
  "function getOperatorReputation(uint256 agentId) view returns (uint256 avgOperator, uint256 countOperator)",
  "function getCall(bytes32 callId) view returns (tuple(uint256 agentId, address client, uint64 recordedAt, bool reviewed))"
];

export const identityAddress = () => process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "0xfdeEE314eb3235a91e00a4EFFb76982F6F96e0C6";
export const reputationAddress = () => process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "0x3A330F950E830f9e2DE8Dde90742D3459db6C54A";
export const stakeManagerAddress = () => process.env.NEXT_PUBLIC_STAKE_MANAGER_ADDRESS || "0x498da2D83e2eC5b3D6FE2499B1dB17719E719da1";

let provider: ethers.JsonRpcProvider | null = null;
export function registryProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz", 10143, { staticNetwork: true });
  }
  return provider;
}

const TTL_MS = 60_000;
let cache: { at: number; agents: Promise<RegistryAgent[]> } | null = null;

export function listRegistryAgents(force = false): Promise<RegistryAgent[]> {
  if (force || !cache || Date.now() - cache.at > TTL_MS) {
    const identity = new ethers.Contract(identityAddress(), IDENTITY_V2_ABI, registryProvider());
    const agents = identity.getAllAgents().then((rows: any[]) =>
      rows.map((a) => ({
        id: Number(a.id),
        owner: a.owner,
        payee: a.payee,
        name: a.name,
        skill: a.skill,
        endpoint: a.endpoint,
        priceUnits: BigInt(a.priceUSDC),
        metadataURI: a.metadataURI,
        active: a.active
      }))
    );
    cache = { at: Date.now(), agents };
    // Don't keep a failed read cached
    agents.catch(() => {
      if (cache?.agents === agents) cache = null;
    });
  }
  return cache.agents;
}

function pinnedIds(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pair of (process.env.AGENT_IDS || "").split(",")) {
    const [skill, id] = pair.split(":").map((s) => s.trim());
    if (skill && id && /^\d+$/.test(id)) out[skill] = Number(id);
  }
  return out;
}

/** The active agent serving `skill`: the AGENT_IDS pin if set, otherwise the lowest active id with that skill */
export async function agentForSkill(skill: string): Promise<RegistryAgent | undefined> {
  const agents = await listRegistryAgents();
  const pinned = pinnedIds()[skill];
  if (pinned !== undefined) return agents.find((a) => a.id === pinned && a.active);
  return agents.filter((a) => a.active && a.skill === skill).sort((x, y) => x.id - y.id)[0];
}
