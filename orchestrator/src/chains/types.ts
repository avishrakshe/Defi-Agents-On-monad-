import { Subtask } from "../router";
import { StepResult } from "../executor";

export type ChainId = "monad" | "magicblock";

export interface ReviewSplit {
  avg: number;
  count: number;
}

export interface ChainAgent {
  id: number;
  name: string;
  skill: string;
  endpoint: string;
  owner: string;
  payee: string;
  priceUnits: string;
  active: boolean;
  stakeUnits: string | null;
  independent: ReviewSplit;
  operator: ReviewSplit;
  paidCalls: number | null;
}

/** One network's implementation of the marketplace loop. executor/router callers go through this. */
export interface ChainAdapter {
  id: ChainId;
  listAgents(): Promise<ChainAgent[]>;
  getReputation(agentId: number): Promise<{ independent: ReviewSplit; operator: ReviewSplit }>;
  decompose(taskText: string): Promise<Subtask[]>;
  payForCall(subtask: Subtask, opts?: { mode?: "A" | "B"; authorization?: any }): Promise<StepResult>;
  /** Operator review of a call the operator paid for (Mode A) */
  submitFeedback(receipt: { agentId: number; callId: string }, score: number, note: string): Promise<any>;
  checkpoint(opts?: { force?: boolean }): Promise<any>;
}

export function chainFromRequest(req: { query?: any; body?: any; headers?: any }): ChainId {
  const v = String(req.query?.chain || req.body?.chain || req.headers?.["x-chain"] || process.env.CHAIN || "monad").toLowerCase();
  return v === "magicblock" ? "magicblock" : "monad";
}
