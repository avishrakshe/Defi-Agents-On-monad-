import { Subtask } from "./router";
import { OrchestratorResults, buildSummary, polishSummary } from "./synthesizer";
import { slotFor } from "./executor";
import { ChainId, getChain } from "./chains";

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

/**
 * Runs every subtask sequentially. In Mode A the orchestrator signs each payment;
 * in Mode B the caller supplies one authorization per subtask (same order).
 */
export async function executeAll(
  taskText: string,
  subtasks: Subtask[],
  mode: "A" | "B" = "A",
  authorizations?: any[],
  chain: ChainId = "monad"
): Promise<OrchestrationResult> {
  const steps: ExecutionStep[] = [];
  const results: OrchestratorResults = {};
  const adapter = getChain(chain);

  for (let i = 0; i < subtasks.length; i++) {
    const subtask = subtasks[i];
    const started = Date.now();
    try {
      const step = await adapter.payForCall(subtask, { mode, authorization: authorizations?.[i] });
      steps.push({ subtask, status: "completed", settlement: step.settlement, result: step.result, durationMs: step.durationMs });
      (results as any)[slotFor(subtask.skill)] = step.result;
    } catch (err: any) {
      console.error(`[Orchestrator] ${subtask.skill} failed:`, err.message);
      steps.push({ subtask, status: "failed", error: err.message, durationMs: Date.now() - started });
    }
  }

  const { summary, polished } = await polishSummary(buildSummary(results));
  return {
    mode: mode === "B" ? "Mode B: Your Wallet" : "Mode A: Autonomous (Orchestrator Pays)",
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

export const executeModeA = (taskText: string, subtasks: Subtask[], chain: ChainId = "monad") => executeAll(taskText, subtasks, "A", undefined, chain);
