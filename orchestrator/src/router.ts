import { agentForSkill, listRegistryAgents, RegistryAgent } from "../../agents/shared/registry";

export interface Subtask {
  /** IdentityRegistryV2 id — used for recordPaidCall and feedback */
  agentId: number;
  skill: string;
  tokenAddress?: string;
  contractAddress?: string;
  network?: string;
  targetUrl: string;
  priceUSDC: string;
  agentName: string;
}

/**
 * Core skills and how to reach them. The registry decides *which* agent id serves a skill (AGENT_IDS can pin it);
 * the URL is the agent's onchain endpoint unless a deployment env var overrides it (local development).
 */
const CORE_SKILLS: Record<string, { env: string; path: string }> = {
  "contract-audit": { env: "CONTRACT_AUDITOR_URL", path: "/api/audit" },
  "token-risk-score": { env: "TOKEN_RISK_URL", path: "/api/score" },
  "gas-timing": { env: "GAS_TIMING_URL", path: "/api/gas" },
  "whale-tracker": { env: "WHALE_AGENT_URL", path: "/api/whale" }
};

const priceLabel = (units: bigint) => `$${(Number(units) / 1_000_000).toFixed(3)}`;

export function toSubtask(agent: RegistryAgent, extra: Partial<Subtask>): Subtask {
  const core = CORE_SKILLS[agent.skill];
  const override = core && process.env[core.env];
  return {
    agentId: agent.id,
    skill: agent.skill,
    targetUrl: override ? `${override.replace(/\/$/, "")}${core.path}` : agent.endpoint,
    priceUSDC: priceLabel(agent.priceUnits),
    agentName: agent.name,
    ...extra
  };
}

/**
 * Deterministic task decomposition: regex address extraction + keyword matching, zero LLM in the critical path.
 * Skills resolve to their active agent in IdentityRegistryV2 (60s cache).
 */
export async function decomposeTask(taskText: string): Promise<Subtask[]> {
  if (!taskText || typeof taskText !== "string") return [];

  const addresses = taskText.match(/0x[a-fA-F0-9]{40}/g) || [];
  const wanted: [string, Partial<Subtask>][] = [];

  if (/risk|safe|token|scam|honeypot|rug/i.test(taskText) && addresses.length > 0) {
    wanted.push(["token-risk-score", { tokenAddress: addresses[0] }]);
  }
  if (/audit|contract|vulnerab|security|bug|exploit/i.test(taskText) && addresses.length > 0) {
    wanted.push(["contract-audit", { contractAddress: addresses[addresses.length - 1] }]);
  }
  if (/gas|timing|transact|fee|congestion|gwei/i.test(taskText)) {
    wanted.push(["gas-timing", { network: "monad-testnet" }]);
  }
  if (/whale|liquidity/i.test(taskText)) {
    wanted.push(["whale-tracker", { tokenAddress: addresses[0] }]);
  }

  const subtasks: Subtask[] = [];
  for (const [skill, extra] of wanted) {
    const agent = await agentForSkill(skill);
    if (agent) subtasks.push(toSubtask(agent, extra));
  }

  // Community agents with other skills, matched on their skill / name keywords
  const lower = taskText.toLowerCase();
  for (const a of await listRegistryAgents()) {
    if (!a.active || CORE_SKILLS[a.skill] || !/^https?:\/\//.test(a.endpoint)) continue;
    const keywords = a.skill.toLowerCase().split(/[-_\s]/).concat(a.name.toLowerCase().split(/[\s&]+/)).filter((k) => k.length > 3);
    if (lower.includes(a.skill.toLowerCase()) || keywords.some((k) => lower.includes(k))) {
      subtasks.push(toSubtask(a, { tokenAddress: addresses[0] }));
    }
  }
  return subtasks;
}
