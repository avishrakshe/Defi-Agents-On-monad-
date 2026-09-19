export interface Subtask {
  skill: "token-risk-score" | "contract-audit" | "gas-timing";
  tokenAddress?: string;
  contractAddress?: string;
  network?: string;
  targetUrl: string;
  priceUSDC: string;
  agentName: string;
}

const AGENT_ENDPOINTS: Record<string, { url: string; name: string }> = {
  "token-risk-score": {
    url: process.env.TOKEN_RISK_URL || "http://localhost:4002",
    name: "Token Risk Scorer"
  },
  "contract-audit": {
    url: process.env.CONTRACT_AUDITOR_URL || "http://localhost:4001",
    name: "Smart Contract Auditor"
  },
  "gas-timing": {
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

  // 1. Token Risk Subtask
  if (/risk|safe|token|scam|honeypot/i.test(taskText) && addresses.length > 0) {
    subtasks.push({
      skill: "token-risk-score",
      tokenAddress: addresses[0],
      targetUrl: `${AGENT_ENDPOINTS["token-risk-score"].url}/api/score`,
      priceUSDC: "$0.001",
      agentName: AGENT_ENDPOINTS["token-risk-score"].name
    });
  }

  // 2. Contract Audit Subtask
  if (/audit|contract|vulnerab|security|bug/i.test(taskText) && addresses.length > 0) {
    subtasks.push({
      skill: "contract-audit",
      contractAddress: addresses[addresses.length - 1],
      targetUrl: `${AGENT_ENDPOINTS["contract-audit"].url}/api/audit`,
      priceUSDC: "$0.001",
      agentName: AGENT_ENDPOINTS["contract-audit"].name
    });
  }

  // 3. Gas Timing Subtask
  if (/gas|timing|transact|fee|congestion|gwei/i.test(taskText)) {
    subtasks.push({
      skill: "gas-timing",
      network: "monad-testnet",
      targetUrl: `${AGENT_ENDPOINTS["gas-timing"].url}/api/gas`,
      priceUSDC: "$0.001",
      agentName: AGENT_ENDPOINTS["gas-timing"].name
    });
  }

  return subtasks;
}
