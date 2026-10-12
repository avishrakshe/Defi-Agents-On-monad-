import { BN } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { GetCommitmentSignature, MAGIC_CONTEXT_ID, MAGIC_PROGRAM_ID, magicFeeVaultPdaFromValidator } from "@magicblock-labs/ephemeral-rollups-sdk";
import { ChainAdapter, ChainAgent } from "./types";
import { Subtask, wantedSkills } from "../router";
import { requestBodyFor, StepResult } from "../executor";
import {
  baseExplorerUrl,
  buildPayForCallTx,
  coder,
  erExplorerUrl,
  listSolanaAgents,
  marketProgram,
  mbConnections,
  mbEnv,
  mbPdas,
  num,
  operatorKeypair,
  pick,
  programId,
  readLive,
  resourceHash,
  SolanaAgent,
  solanaAgentForSkill
} from "../../../agents/shared/solanaMarket";

const MAX_PRICE_UNITS = BigInt(process.env.MAX_PRICE_UNITS || "10000");
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 30000);

/** Where the orchestrator reaches an agent: its onchain endpoint, or MB_AGENT_BASE_URL in local development */
function targetUrlFor(agent: SolanaAgent) {
  const override = process.env.MB_AGENT_BASE_URL;
  if (!override) return agent.endpoint;
  const rest = agent.endpoint.split("/mb/agents/")[1];
  return rest ? `${override.replace(/\/$/, "")}/${rest}` : agent.endpoint;
}

const priceLabel = (units: bigint) => `$${(Number(units) / 1e6).toFixed(3)}`;

/** Subtask for a registered agent_market agent — URL, skill and price always come from the registry */
export function subtaskFor(a: SolanaAgent, extra: Partial<Subtask> = {}): Subtask {
  return { agentId: a.id, skill: a.skill, targetUrl: targetUrlFor(a), priceUSDC: `${priceLabel(a.priceUnits)}`, agentName: a.name, ...extra };
}
const split = (sum: any, count: any) => ({ avg: num(count) ? Math.round(num(sum) / num(count)) : 0, count: num(count) });

function requireOperator() {
  const op = operatorKeypair();
  if (!op) throw new Error("SOLANA_OPERATOR_SECRET_KEY is not configured");
  return op;
}

async function sendEr(tx: Transaction, signer = requireOperator()) {
  const { er } = mbConnections();
  const { blockhash, lastValidBlockHeight } = await er.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = signer.publicKey;
  tx.sign(signer);
  const t0 = performance.now();
  const sig = await er.sendRawTransaction(tx.serialize(), { skipPreflight: true });
  const res = await er.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  const ms = Math.round(performance.now() - t0);
  if (res.value.err) {
    const logs = (await er.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }).catch(() => null))?.meta?.logMessages || [];
    throw new Error(`ER tx ${sig} failed: ${logs.find((l) => /Error Message|AnchorError/.test(l)) || JSON.stringify(res.value.err)}`);
  }
  return { sig, ms };
}

export interface CheckpointRecord {
  erSignature: string;
  erExplorerUrl: string;
  commitSignature?: string;
  commitExplorerUrl?: string;
  payouts: { agentId: number; signature: string; explorerUrl: string; amountUnits?: number }[];
  forced: boolean;
  at: string;
  error?: string;
}
let lastCheckpoint: CheckpointRecord | null = null;
export const getLastCheckpoint = () => lastCheckpoint;

/** paid_total of an agent's AgentPayout on base (written only by the payout Magic Action) */
async function paidTotal(agentId: number) {
  const info = await mbConnections().base.getAccountInfo(mbPdas.payout(agentId)).catch(() => null);
  return info ? num(pick(coder.accounts.decode("AgentPayout", info.data), "paid_total")) : 0;
}

/**
 * Schedule a checkpoint on the ER. With wait=true, also resolve the base commit signature and watch for the payout
 * actions (attributed by a rise in AgentPayout.paid_total). With wait=false, return as soon as the ER accepted it.
 */
export async function runCheckpoint(force: boolean, wait = true): Promise<CheckpointRecord> {
  const op = requireOperator();
  const { er, base } = mbConnections();
  const agents = (await listSolanaAgents()).filter((a) => a.active);
  const before = Object.fromEntries(await Promise.all(agents.map(async (a) => [a.id, await paidTotal(a.id)] as const)));
  const ix = await marketProgram(er, op)
    .methods.checkpoint(agents.length)
    .accountsPartial({
      ledger: mbPdas.ledger(),
      config: mbPdas.config(),
      magicFeeVault: magicFeeVaultPdaFromValidator(new PublicKey(mbEnv().validator)),
      programId: programId(),
      caller: force ? op.publicKey : null,
      magicProgram: MAGIC_PROGRAM_ID,
      magicContext: MAGIC_CONTEXT_ID
    })
    .remainingAccounts([
      ...agents.flatMap((a) => [
        { pubkey: mbPdas.stats(a.id), isSigner: false, isWritable: true },
        { pubkey: mbPdas.agent(a.id), isSigner: false, isWritable: false }
      ]),
      { pubkey: mbPdas.tab(op.publicKey), isSigner: false, isWritable: true }
    ])
    .instruction();
  const { sig } = await sendEr(new Transaction().add(ix), op);
  const rec: CheckpointRecord = { erSignature: sig, erExplorerUrl: erExplorerUrl(sig), payouts: [], forced: force, at: new Date().toISOString() };
  const logs = (await er.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }).catch(() => null))?.meta?.logMessages || [];
  if (logs.some((l) => l.includes("checkpoint not due"))) return { ...rec, skipped: true } as CheckpointRecord & { skipped: boolean };
  lastCheckpoint = rec;
  if (!wait) return rec;
  try {
    rec.commitSignature = await GetCommitmentSignature(sig, er);
    rec.commitExplorerUrl = baseExplorerUrl(rec.commitSignature);
    // Payout actions run on base after the commit; an agent was paid iff its paid_total rose
    for (let i = 0; i < 15 && rec.payouts.length === 0; i++) {
      const raised = (await Promise.all(agents.map(async (a) => [a.id, await paidTotal(a.id)] as const))).filter(([id, now]) => now > before[id]);
      if (raised.length) {
        const sig = (await base.getSignaturesForAddress(mbPdas.payout(raised[0][0]), { limit: 1 }))[0]?.signature;
        for (const [agentId, now] of raised) {
          rec.payouts.push({ agentId, signature: sig, explorerUrl: baseExplorerUrl(sig), amountUnits: now - before[agentId] });
        }
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (err: any) {
    rec.error = err.message;
  }
  return rec;
}

/** Auto-trigger: checkpoint once the Ledger says it is due (every N calls or N seconds); the program re-checks */
export async function checkpointIfDue() {
  const ledger = await readLive(mbPdas.ledger(), "Ledger");
  const config = await readLive(mbPdas.config(), "Config");
  if (!ledger || !config) return null;
  const calls = num(pick(ledger.data, "calls_since_checkpoint"));
  const since = Date.now() / 1000 - num(pick(ledger.data, "last_checkpoint_ts"));
  const due = calls >= num(pick(config.data, "checkpoint_every_calls")) || (calls > 0 && since >= num(pick(config.data, "checkpoint_every_secs")));
  return due ? runCheckpoint(false, false) : null;
}

export const magicblockChain: ChainAdapter = {
  id: "magicblock",

  async listAgents(): Promise<ChainAgent[]> {
    const agents = await listSolanaAgents();
    // Two batched reads: base tells us which AgentStats are delegated; those are read from the ER, the rest from base
    const { base, er } = mbConnections();
    const keys = agents.map((a) => mbPdas.stats(a.id));
    const baseInfos = await base.getMultipleAccountsInfo(keys);
    const delegatedIdx = baseInfos.map((info, i) => (info && !info.owner.equals(programId()) ? i : -1)).filter((i) => i >= 0);
    const erInfos = delegatedIdx.length ? await er.getMultipleAccountsInfo(delegatedIdx.map((i) => keys[i])) : [];
    const statsData = baseInfos.map((info, i) => {
      const j = delegatedIdx.indexOf(i);
      const src = j >= 0 ? erInfos[j] : info;
      try {
        return src ? coder.accounts.decode("AgentStats", src.data) : null;
      } catch {
        return null;
      }
    });
    return Promise.all(
      agents.map(async (a, idx) => {
        const s: any = statsData[idx];
        return {
          id: a.id,
          name: a.name,
          skill: a.skill,
          endpoint: a.endpoint,
          owner: a.owner,
          payee: a.payee,
          priceUnits: a.priceUnits.toString(),
          active: a.active,
          stakeUnits: a.stake.toString(),
          independent: s ? split(pick(s, "client_score_sum"), pick(s, "client_reviews")) : { avg: 0, count: 0 },
          operator: s ? split(pick(s, "operator_score_sum"), pick(s, "operator_reviews")) : { avg: 0, count: 0 },
          paidCalls: s ? num(pick(s, "paid_calls")) : null,
          metadataURI: a.metadataUri
        };
      })
    );
  },

  async getReputation(agentId) {
    const s = (await readLive(mbPdas.stats(agentId), "AgentStats"))?.data;
    return {
      independent: split(pick(s, "client_score_sum"), pick(s, "client_reviews")),
      operator: split(pick(s, "operator_score_sum"), pick(s, "operator_reviews"))
    };
  },

  async decompose(taskText) {
    const out: Subtask[] = [];
    for (const [skill, extra] of wantedSkills(taskText)) {
      const a = await solanaAgentForSkill(skill);
      if (a) out.push(subtaskFor(a, extra));
    }
    return out;
  },

  /** Mode A: the operator signs pay_for_call from its own Tab. Mode B: the browser already signed it. */
  async payForCall(subtask, opts = {}): Promise<StepResult> {
    const started = Date.now();
    const body = requestBodyFor(subtask);
    let header: string;
    let payee: string | undefined;
    if (opts.mode === "B") {
      if (typeof opts.authorization !== "string") throw new Error("Mode B requires a base64 signed pay_for_call transaction");
      header = opts.authorization;
    } else {
      const op = requireOperator();
      const quoteRes = await fetch(subtask.targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(AGENT_TIMEOUT_MS)
      });
      const quote: any = (await quoteRes.json().catch(() => ({})))?.x402?.accepts?.[0];
      if (quoteRes.status !== 402 || !quote) throw new Error(`${subtask.agentName}: expected an er-tab 402, got HTTP ${quoteRes.status}`);
      const agent = (await listSolanaAgents()).find((a) => a.id === subtask.agentId);
      if (!agent || quote.agentId !== agent.id || quote.payTo !== agent.payee) throw new Error(`${subtask.agentName}: 402 does not match the registered agent/payee`);
      if (BigInt(quote.maxAmountRequired) > MAX_PRICE_UNITS) throw new Error(`${subtask.agentName}: price above MAX_PRICE_UNITS`);
      payee = quote.payTo;
      const path = new URL(subtask.targetUrl).pathname;
      const { tx } = await buildPayForCallTx(op.publicKey, agent.id, BigInt(quote.maxAmountRequired), resourceHash("POST", path, body));
      tx.sign(op);
      header = tx.serialize().toString("base64");
    }

    const res = await fetch(subtask.targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Payment": header },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AGENT_TIMEOUT_MS)
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${subtask.agentName} responded HTTP ${res.status}: ${json?.reason || json?.error || res.statusText}`);
    const r = json.settlement;
    const settlement: any = {
      payment: r,
      payee: r?.payTo || payee,
      callId: r?.callId,
      erSignature: r?.erSignature,
      confirmMs: r?.confirmMs,
      receiptPda: r?.receiptPda,
      txHash: r?.erSignature,
      explorerUrl: r?.explorerUrl
    };
    // Settle to base when due; failures here never fail the paid call
    settlement.checkpoint = await checkpointIfDue().catch((err) => ({ error: err.message }));
    return { subtask, settlement, result: json.data, durationMs: Date.now() - started };
  },

  async submitFeedback({ agentId, callId }, score, note) {
    void note; // reviews are scores only on the ER; the note stays off-chain
    const op = requireOperator();
    const id = Array.from(Buffer.from(callId, "hex"));
    const ix = await marketProgram(mbConnections().er, op)
      .methods.submitFeedback(new BN(agentId), id, Math.min(100, Math.max(0, Math.round(score))))
      .accountsPartial({
        reviewer: op.publicKey,
        tab: mbPdas.tab(op.publicKey),
        agentProfile: mbPdas.agent(agentId),
        agentStats: mbPdas.stats(agentId),
        receipt: mbPdas.receipt(op.publicKey, Uint8Array.from(id))
      })
      .instruction();
    const { sig, ms } = await sendEr(new Transaction().add(ix), op);
    return { kind: "Operator", txHash: sig, confirmMs: ms, explorerUrl: erExplorerUrl(sig), reputation: { agentId, ...(await magicblockChain.getReputation(agentId)) } };
  },

  checkpoint: (opts = {}) => runCheckpoint(!!opts.force)
};
