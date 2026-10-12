import { AgentData, fetchLiveAgents } from "./contracts";
import { fetchMagicblockAgents } from "./magicblock";
import type { Network } from "./network";

/** Registry for the selected network: Monad reads IdentityRegistryV2 directly; MagicBlock reads agent_market via the backend */
export function fetchAgentsFor(network: Network): Promise<AgentData[]> {
  return network === "magicblock" ? fetchMagicblockAgents().catch(() => []) : fetchLiveAgents();
}
