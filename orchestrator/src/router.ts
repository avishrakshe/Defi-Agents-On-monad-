export interface Subtask {
  /** Onchain IdentityRegistry id — used for recordPaidCall and feedback */
  agentId: number;
  skill: string;
  tokenAddress?: string;
  contractAddress?: string;
  network?: string;
  targetUrl: string;
  priceUSDC: string;
  agentName: string;
}

const AGENT_ENDPOINTS: Record<string, { id: number; url: string; name: string }> = {
  "contract-audit": {
    id: 1,
    url: process.env.CONTRACT_AUDITOR_URL || "http://localhost:4001",
    name: "Smart Contract Auditor"
  },
  "token-risk-score": {
    id: 2,
    url: process.env.TOKEN_RISK_URL || "http://localhost:4002",
    name: "Token Risk Scorer"
  },
  "gas-timing": {
    id: 3,
    url: process.env.GAS_TIMING_URL || "http://localhost:4003",
    name: "Gas Price & Transaction Timing Agent"
  }
};

/**
 * Deterministic Task Decomposition
 * Uses regex address extraction and keyword matching with zero LLM in the critical path.
 */
export function decomposeTask(taskText: string): Subtask[] {
  if (!taskText || typeof taskText !== "string") {
    return [];
  }

  const subtasks: Subtask[] = [];
  const addresses = taskText.match(/0x[a-fA-F0-9]{40}/g) || [];
  const make = (skill: keyof typeof AGENT_ENDPOINTS, path: string, extra: Partial<Subtask>): Subtask => ({
    agentId: AGENT_ENDPOINTS[skill].id,
    skill,
    targetUrl: `${AGENT_ENDPOINTS[skill].url}${path}`,
    priceUSDC: "$0.001",
    agentName: AGENT_ENDPOINTS[skill].name,
    ...extra
  });

  // 1. Token Risk Subtask
  if (/risk|safe|token|scam|honeypot|rug/i.test(taskText) && addresses.length > 0) {
    subtasks.push(make("token-risk-score", "/api/score", { tokenAddress: addresses[0] }));
  }

  // 2. Contract Audit Subtask
  if (/audit|contract|vulnerab|security|bug|exploit/i.test(taskText) && addresses.length > 0) {
    subtasks.push(make("contract-audit", "/api/audit", { contractAddress: addresses[addresses.length - 1] }));
  }

  // 3. Gas Timing Subtask
  if (/gas|timing|transact|fee|congestion|gwei/i.test(taskText)) {
    subtasks.push(make("gas-timing", "/api/gas", { network: "monad-testnet" }));
  }

  return subtasks;
}
