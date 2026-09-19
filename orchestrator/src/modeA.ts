import { Subtask } from "./router";
import { OrchestratorResults, buildSummary, polishSummary } from "./synthesizer";

export interface ExecutionStep {
  subtask: Subtask;
  status: "pending" | "paid" | "completed" | "failed";
  settlement?: any;
  result?: any;
  durationMs: number;
  error?: string;
}

export interface OrchestrationResult {
  mode: "Mode A: Autonomous (Orchestrator Pays)" | "Mode B: Your Wallet";
  taskText: string;
  subtasks: Subtask[];
  steps: ExecutionStep[];
  results: OrchestratorResults;
  summary: string;
  polished: boolean;
  totalCostUSDC: string;
  timestamp: string;
}

export async function executeModeA(taskText: string, subtasks: Subtask[]): Promise<OrchestrationResult> {
  const orchestratorWallet = process.env.ORCHESTRATOR_WALLET_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const steps: ExecutionStep[] = [];
  const results: OrchestratorResults = {};

  for (const subtask of subtasks) {
    const startTime = Date.now();
    const step: ExecutionStep = {
      subtask,
      status: "pending",
      durationMs: 0
    };

    try {
      // Generate x402 payment authorization header for specialist agent
      const paymentAuth = JSON.stringify({
        from: orchestratorWallet,
        scheme: "exact",
        network: process.env.NEXT_PUBLIC_MONAD_NETWORK || "eip155:10143",
        payTo: process.env.PAY_TO_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        asset: process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3",
        amount: "1000",
        simulated: !process.env.PAY_TO_ADDRESS || process.env.PAY_TO_ADDRESS === "[WALLET_ADDRESS]"
      });

      let requestBody: any = {};
      if (subtask.skill === "token-risk-score") {
        requestBody = { tokenAddress: subtask.tokenAddress };
      } else if (subtask.skill === "contract-audit") {
        requestBody = { contractAddress: subtask.contractAddress };
      } else if (subtask.skill === "gas-timing") {
        requestBody = { network: "monad-testnet" };
      }

      const res = await fetch(subtask.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payment-Authorization": paymentAuth
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10000)
      });

      step.durationMs = Date.now() - startTime;

      if (!res.ok) {
        throw new Error(`Specialist agent HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      step.status = "completed";
      step.settlement = json.settlement;
      step.result = json.data;

      // Map into structured results
      if (subtask.skill === "token-risk-score") {
        results.riskScore = json.data;
      } else if (subtask.skill === "gas-timing") {
        results.gasTiming = json.data;
      } else if (subtask.skill === "contract-audit") {
        results.audit = json.data;
      }
    } catch (err: any) {
      step.status = "failed";
      step.error = err.message;
      step.durationMs = Date.now() - startTime;
      console.error(`[Orchestrator] Error executing ${subtask.skill}:`, err.message);
    }

    steps.push(step);
  }

  // Synthesis
  const deterministicSummary = buildSummary(results);
  const { summary, polished } = await polishSummary(deterministicSummary);

  return {
    mode: "Mode A: Autonomous (Orchestrator Pays)",
    taskText,
    subtasks,
    steps,
    results,
    summary,
    polished,
    totalCostUSDC: `$${(subtasks.length * 0.001).toFixed(3)}`,
    timestamp: new Date().toISOString()
  };
}
