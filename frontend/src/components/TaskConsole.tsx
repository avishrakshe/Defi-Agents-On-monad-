"use client";

import React, { useState, useEffect, useRef } from "react";
import { connectBrowserWallet, quoteX402, signRealX402Payment } from "../lib/wallet";
import { ORCHESTRATOR_ADDRESS } from "../lib/useBalances";
import { useActivityStore } from "../lib/activity-store";
import { MONAD_CONTRACTS, ReviewSplit, splitLabel } from "../lib/contracts";
import { AgentResultCards, AgentRun } from "./AgentResultCards";
import { getOrchestratorUrl } from "../lib/orchestrator";
import { useNetwork } from "../lib/network";
import { useWallet } from "@solana/wallet-adapter-react";
import { getMetrics, signPayForCall, MagicblockMetrics } from "../lib/magicblock";
import { MagicBlockTabPanel } from "./MagicBlockTabPanel";

interface Trust {
  registered: boolean;
  active: boolean;
  owner?: string;
  payee?: string;
  stakeUSDC: number | null;
  independent: ReviewSplit | null;
  operator: ReviewSplit | null;
}

interface StepLog {
  agentId: number;
  agentName: string;
  skill: string;
  state: "signing" | "running" | "recording" | "done" | "failed";
  payment?: { status: string; txHash?: string; reason?: string };
  payee?: string;
  callId?: string;
  recordTx?: string;
  feedbackTx?: string;
  score?: number;
  durationMs?: number;
  error?: string;
  trust?: Trust;
  /** MagicBlock: ER payment signature, its explorer link and measured confirm ms */
  erSig?: string;
  erUrl?: string;
  confirmMs?: number;
  receiptPda?: string;
  feedbackUrl?: string;
}

/** Commit + payout that carried a MagicBlock run to Solana, observed after the run */
interface SettlementWatch {
  state: "waiting" | "landed" | "timeout";
  commit?: { signature: string; explorerUrl: string };
  payouts?: { agentId: number; skill: string; signature: string; url: string; paidTotalUnits: number }[];
}

/** Same request body the orchestrator sends, so the 402 probe hits the same resource */
const requestBodyFor = (s: any) =>
  s.skill === "token-risk-score"
    ? { tokenAddress: s.tokenAddress }
    : s.skill === "contract-audit"
    ? { contractAddress: s.contractAddress }
    : s.skill === "gas-timing"
    ? { network: "monad-testnet" }
    : { tokenAddress: s.tokenAddress, contractAddress: s.contractAddress, network: "monad-testnet" };

const EXPLORER = "https://testnet.monadvision.com";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const shortHash = (h?: string) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "");

/**
 * Deterministic service-quality score submitted as onchain feedback.
 * Rewards complete, verified, fast answers; every input comes from the agent's actual response.
 */
function qualityScore(skill: string, d: any, durationMs: number): { score: number; note: string } {
  if (!d) return { score: 0, note: "No data returned" };
  let score = 100;
  const notes: string[] = [];
  if (skill === "contract-audit") {
    if (!d.sourceVerified) (score -= 4), notes.push("bytecode-only");
    notes.push(`${d.findings?.length ?? 0} findings, security ${d.securityScore}/100`);
  } else if (skill === "token-risk-score") {
    if (!d.name || !d.symbol) (score -= 3), notes.push("missing metadata");
    if (!d.blocksScanned) (score -= 3), notes.push("no log scan");
    notes.push(`risk ${d.score}/100 over ${d.blocksScanned} blocks`);
  } else if (skill === "gas-timing") {
    if ((d.sampleBlocks ?? 0) < 20) (score -= 3), notes.push("thin fee history");
    notes.push(`${d.currentGasPriceGwei} gwei, ${d.blockUtilizationPct}% util`);
  } else {
    notes.push(d.summary ? "summary provided" : "raw output");
  }
  if (durationMs > 15000) (score -= 4), notes.push("slow");
  else if (durationMs > 8000) (score -= 2), notes.push("moderate latency");
  return { score: Math.max(0, Math.min(100, score)), note: `Quality ${score}/100: ${notes.join(", ")} (${(durationMs / 1000).toFixed(1)}s)` };
}

interface TaskConsoleProps {
  /** Prefills the prompt (e.g. when an agent card's "Test agent directly" is clicked) */
  initialPrompt?: string;
}

export const TaskConsole: React.FC<TaskConsoleProps> = ({ initialPrompt }) => {
  const [taskText, setTaskText] = useState(
    "Is token 0x534b2f3A21130d7a60830c2Df862319e593943A3 safe, audit contract 0x534b2f3A21130d7a60830c2Df862319e593943A3, track whale liquidity, and tell me if gas is good right now on Monad."
  );
  const [useUserWallet, setUseUserWallet] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<StepLog[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [synthesizedAnswer, setSynthesizedAnswer] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const orchestratorAddress = ORCHESTRATOR_ADDRESS;
  const { network } = useNetwork();
  const mb = network === "magicblock";
  const solana = useWallet();
  const [settlement, setSettlement] = useState<SettlementWatch | null>(null);

  /** After a MagicBlock run: wait for the next checkpoint commit (crank or auto-trigger) and the payouts it carried */
  const watchSettlement = async (baseline: MagicblockMetrics | null, startedAt: number) => {
    setSettlement({ state: "waiting" });
    for (let i = 0; i < 30; i++) {
      await sleep(5000);
      const m = await getMetrics().catch(() => null);
      if (!m?.lastCommit || m.lastCommit.signature === baseline?.lastCommit?.signature) continue;
      // An agent was paid by this settlement iff its paid_total rose above the value before the run
      const before = (id: number) => baseline?.payouts.find((b) => b.agentId === id)?.paidTotalUnits ?? 0;
      const payouts = m.payouts
        .filter((p) => p.lastPayoutSignature && p.paidTotalUnits > before(p.agentId))
        .map((p) => ({ agentId: p.agentId, skill: p.skill, signature: p.lastPayoutSignature!, url: p.lastPayoutExplorerUrl!, paidTotalUnits: p.paidTotalUnits - before(p.agentId) }));
      setSettlement({ state: "landed", commit: { signature: m.lastCommit.signature, explorerUrl: m.lastCommit.explorerUrl }, payouts });
      if (payouts.length) return;
    }
    setSettlement((s) => (s?.state === "landed" ? s : { state: "timeout" }));
  };

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      (window as any).ethereum
        .request({ method: "eth_accounts" })
        .then((accs: string[]) => {
          if (accs && accs.length > 0) setUserAddress(accs[0]);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (initialPrompt) setTaskText(initialPrompt);
  }, [initialPrompt]);

  // Auto-scroll the log container smoothly as new lines appear
  useEffect(() => {
    logsContainerRef.current?.scrollTo({ top: logsContainerRef.current.scrollHeight, behavior: "smooth" });
  }, [steps]);

  const patchStep = (i: number, patch: Partial<StepLog>) =>
    setSteps((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  const handleRunTask = async () => {
    setIsRunning(true);
    setSteps([]);
    setRuns([]);
    setFatalError(null);
    setSynthesizedAnswer(null);
    setSettlement(null);
    setStatusMessage("Decomposing task into specialist workflows...");

    const orchestratorUrl = getOrchestratorUrl();
    const q = mb ? "?chain=magicblock" : "";
    let payer = orchestratorAddress;
    const runStarted = Date.now();
    const baselineMetrics = mb ? await getMetrics().catch(() => null) : null;

    try {
      // 1. Decompose (includes onchain discovery of community agents)
      const decompRes = await fetch(`${orchestratorUrl}/api/decompose${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskText })
      }).catch(() => {
        throw new Error(`Orchestrator unreachable at ${orchestratorUrl}. Start it with "npm start" in /orchestrator.`);
      });
      const { subtasks = [] } = await decompRes.json();
      if (subtasks.length === 0) {
        throw new Error("Could not decompose task. Include a token/contract address (0x...) or ask about gas, risk, audit or whales.");
      }

      if (useUserWallet && mb) {
        if (!solana.publicKey || !solana.signTransaction) throw new Error("Connect a Solana wallet (devnet) and open a Tab first.");
        payer = solana.publicKey.toBase58();
      } else if (useUserWallet) {
        if (!userAddress) {
          setStatusMessage("Connecting wallet...");
          const wallet = await connectBrowserWallet();
          setUserAddress(wallet.address);
          payer = wallet.address;
        } else {
          payer = userAddress;
        }
      }

      setSteps(subtasks.map((s: any) => ({ agentId: s.agentId, agentName: s.agentName, skill: s.skill, trust: s.trust, state: "signing" as const })));
      const accumulated: Record<string, any> = {};

      // 2. Execute each specialist sequentially
      for (let i = 0; i < subtasks.length; i++) {
        const subtask = subtasks[i];
        const t0 = Date.now();

        try {
          // Mode B: real x402 round trip from the browser — read the agent's 402, then sign to *its* payee
          let authorization: any;
          if (useUserWallet && mb) {
            // MagicBlock Mode B: the wallet signs one pay_for_call from the user's Tab, bound to this exact request
            setStatusMessage(`[${i + 1}/${subtasks.length}] Sign ${subtask.priceUSDC} tUSDC for ${subtask.agentName} in your wallet (pays on the ER)...`);
            ({ authorization } = await signPayForCall(payer, subtask.agentId, subtask.targetUrl, requestBodyFor(subtask), solana.signTransaction!));
          } else if (useUserWallet) {
            setStatusMessage(`[${i + 1}/${subtasks.length}] Reading ${subtask.agentName}'s payment requirements (HTTP 402)...`);
            const quote = await quoteX402(subtask.targetUrl, requestBodyFor(subtask));
            if (quote.agentId !== undefined && quote.agentId !== subtask.agentId) {
              throw new Error(`402 is for agent #${quote.agentId}, expected #${subtask.agentId}`);
            }
            if (subtask.trust?.payee && quote.payTo.toLowerCase() !== subtask.trust.payee.toLowerCase()) {
              throw new Error(`402 payTo ${quote.payTo} is not the registered payee ${subtask.trust.payee}`);
            }
            setStatusMessage(
              `[${i + 1}/${subtasks.length}] Sign ${(Number(quote.maxAmountRequired) / 1e6).toFixed(3)} USDC to ${quote.payTo.slice(0, 6)}…${quote.payTo.slice(-4)} in your wallet...`
            );
            authorization = await signRealX402Payment(payer, quote.payTo, quote.maxAmountRequired);
          }

          patchStep(i, { state: "running" });
          setStatusMessage(`[${i + 1}/${subtasks.length}] ${subtask.agentName}: x402 payment → onchain analysis...`);

          const stepRes = await fetch(`${orchestratorUrl}/api/execute-step${q}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subtask, mode: useUserWallet ? "B" : "A", authorization })
          });
          const stepData = await stepRes.json();
          if (!stepRes.ok) throw new Error(stepData.details || stepData.error || "Subtask execution failed");

          const durationMs = Date.now() - t0;
          const st = stepData.settlement || {};
          const pay = st.payment;
          const recordTx: string | undefined = st.recordTxHash;
          const callId: string | undefined = st.callId;
          const slot =
            subtask.skill === "token-risk-score" ? "riskScore" : subtask.skill === "contract-audit" ? "audit" : subtask.skill === "gas-timing" ? "gasTiming" : subtask.skill;
          accumulated[slot] = stepData.result;
          patchStep(i, {
            state: "recording",
            payment: pay && { status: pay.status, txHash: pay.txHash, reason: pay.reason },
            payee: st.payee,
            callId,
            recordTx,
            durationMs,
            ...(mb ? { erSig: st.erSignature, erUrl: st.explorerUrl, confirmMs: st.confirmMs, receiptPda: st.receiptPda } : {})
          });

          // The activity log records Monad transactions; MagicBlock payments are linked in the dispatch log instead
          if (pay?.settled && !mb) {
            useActivityStore.getState().addActivity({
              type: "x402_payment",
              title: `x402 call · ${subtask.agentName}`,
              description: `Settled ${pay.amount} to the agent's payee ${pay.payTo} via EIP-3009${callId ? ` and recorded paid call ${callId.slice(0, 10)}…` : ""}.`,
              txHash: pay.txHash,
              blockNumber: pay.blockNumber,
              timestamp: new Date().toISOString(),
              status: "settled",
              from: payer,
              to: pay.payTo,
              contractName: "USDC (EIP-3009)",
              agentId: subtask.agentId,
              agentName: subtask.agentName,
              skill: subtask.skill,
              amount: pay.amount,
              metadata: { recordTxHash: recordTx, callId, mode: useUserWallet ? "Mode B (Client Signed)" : "Mode A (Autonomous)" }
            });
          }

          // 3. Mode A: the orchestrator rates the call it paid for — stored as an Operator review.
          //    Mode B: no automatic review; the user rates from their own wallet on the result card (independent).
          let feedbackTx: string | undefined;
          let feedbackUrl: string | undefined;
          let score: number | undefined;
          if (!useUserWallet && callId) {
            const qs = qualityScore(subtask.skill, stepData.result, durationMs);
            score = qs.score;
            setStatusMessage(`[${i + 1}/${subtasks.length}] Recording operator review for ${subtask.agentName} (${score}/100)...`);
            try {
              const fbRes = await fetch(`${orchestratorUrl}/api/feedback${q}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agentId: subtask.agentId, callId, score, note: qs.note })
              });
              const fb = await fbRes.json();
              if (fbRes.ok && fb.txHash) {
                feedbackTx = fb.txHash;
                feedbackUrl = fb.explorerUrl;
              }
              if (fbRes.ok && fb.txHash && !mb) {
                useActivityStore.getState().addActivity({
                  type: "reputation_feedback",
                  title: `Operator review · ${subtask.agentName}`,
                  description: `Orchestrator scored its own Mode A call ${score}/100. Operator ${splitLabel(fb.reputation.operator)}, independent ${splitLabel(fb.reputation.independent)}.`,
                  txHash: fb.txHash,
                  blockNumber: fb.blockNumber,
                  timestamp: new Date().toISOString(),
                  status: "confirmed",
                  from: orchestratorAddress,
                  to: MONAD_CONTRACTS.reputationRegistry,
                  contractName: "ReputationRegistryV2",
                  agentId: subtask.agentId,
                  agentName: subtask.agentName,
                  skill: subtask.skill,
                  metadata: { scoreGiven: score, note: qs.note, callId, reviewerKind: "Operator" }
                });
              }
            } catch {
              // Feedback is best-effort; the step itself already succeeded
            }
          }

          setRuns((prev) => [
            ...prev,
            {
              agentId: subtask.agentId,
              agentName: subtask.agentName,
              skill: subtask.skill,
              result: stepData.result,
              durationMs,
              review: callId
                ? { mode: useUserWallet ? "B" : "A", chain: mb ? "magicblock" : "monad", callId, operatorScore: score, operatorTx: feedbackTx, operatorTxUrl: feedbackUrl }
                : undefined
            }
          ]);
          patchStep(i, { state: "done", feedbackTx, feedbackUrl, score });
        } catch (stepErr: any) {
          patchStep(i, { state: "failed", error: stepErr.message, durationMs: Date.now() - t0 });
        }
        await sleep(200);
      }

      if (Object.keys(accumulated).length === 0) throw new Error("No specialist returned data.");
      // Start watching for the checkpoint as soon as the payments are in, not after the answer has typed out
      if (mb) watchSettlement(baselineMetrics, runStarted);

      // 4. Synthesize
      setStatusMessage("Synthesizing multi-agent intelligence...");
      const synthRes = await fetch(`${orchestratorUrl}/api/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: accumulated })
      });
      const synthData = await synthRes.json();
      const rawSummary: string = synthData.summary || "Task executed across all specialist agents.";

      // Typewriter stream, preserving line breaks
      const tokens = rawSummary.split(/(\s+)/);
      let shown = "";
      for (const tok of tokens) {
        shown += tok;
        setSynthesizedAnswer(shown);
        if (tok.trim()) await sleep(18);
      }

      if (mb) {
        setStatusMessage("Completed — payments settled on the MagicBlock ER; the next checkpoint commits them to Solana (see below).");
      } else {
        setStatusMessage("Completed — every hash below is a real Monad Testnet transaction.");
      }
    } catch (err: any) {
      console.error("Task execution error:", err);
      setFatalError(err.message);
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const solAddr = solana.publicKey?.toBase58();
  const payingWith = mb
    ? useUserWallet
      ? `your Tab ${solAddr ? `${solAddr.slice(0, 4)}…${solAddr.slice(-4)}` : "(connect a Solana wallet)"}`
      : "the operator's Tab (MagicBlock ER)"
    : useUserWallet
    ? `your wallet ${userAddress ? `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}` : "(not connected)"}`
    : `orchestrator ${orchestratorAddress.slice(0, 6)}…${orchestratorAddress.slice(-4)}`;

  const TxLink: React.FC<{ label: string; hash?: string; url?: string; suffix?: string }> = ({ label, hash, url, suffix }) =>
    hash ? (
      <div className="flex items-center gap-2">
        <span className="text-ink-3 w-20 shrink-0">{label}</span>
        <a href={url || `${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer" className="text-violet hover:underline truncate">
          {shortHash(hash)} ↗
        </a>
        {suffix && <span className="text-ink-2 shrink-0">{suffix}</span>}
      </div>
    ) : null;

  return (
    <div className="w-full border-[1.5px] border-ink bg-paper-card shadow-hard">
      {/* Form header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-7 py-3 border-b-[1.5px] border-ink bg-paper-shade font-mono text-[11px] uppercase tracking-[0.14em]">
        <span>Work order · x402 dispatch</span>
        <span className="text-ink-2">
          Billed to: <span className="text-ink">{payingWith}</span>
        </span>
      </div>

      <div className="p-5 sm:p-7">
        {/* Request field */}
        <label htmlFor="task-input" className="kicker block mb-2">
          1. Describe the job
        </label>
        <textarea
          id="task-input"
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          rows={3}
          className="w-full bg-ledger-lines bg-paper border-[1.5px] border-ink px-4 py-[6px] text-[15px] leading-8 text-ink placeholder:text-ink-3 focus:outline-none focus:shadow-hard-violet resize-y font-mono transition-shadow"
          placeholder="e.g. Is token 0x… safe, and is gas good right now?"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["Full scan", "Is token 0x534b2f3A21130d7a60830c2Df862319e593943A3 safe, audit contract 0x534b2f3A21130d7a60830c2Df862319e593943A3, track whale liquidity, and tell me if gas is good right now on Monad."],
            ["Audit registry", `Audit contract ${MONAD_CONTRACTS.reputationRegistry} for vulnerabilities`],
            ["Gas now", "What is the current gas timing and congestion on Monad?"],
            ["Whale watch", "Track whale and liquidity moves for 0x534b2f3A21130d7a60830c2Df862319e593943A3"]
          ].map(([label, prompt]) => (
            <button key={label} onClick={() => setTaskText(prompt)} disabled={isRunning} className="chip-cyber">
              {label}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="mt-6 pt-5 border-t border-dashed border-ink/30 flex flex-wrap items-center gap-x-6 gap-y-4">
          <span className="kicker">2. Dispatch</span>
          <button onClick={handleRunTask} disabled={isRunning || !taskText.trim()} className="btn-neon disabled:opacity-50 disabled:pointer-events-none">
            {isRunning ? (
              <>
                <span className="w-2 h-2 bg-flame animate-blink inline-block" />
                <span>Agents working…</span>
              </>
            ) : (
              <span>Run task →</span>
            )}
          </button>

          <label htmlFor="userWalletCheckbox" className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              id="userWalletCheckbox"
              checked={useUserWallet}
              onChange={(e) => setUseUserWallet(e.target.checked)}
              className="peer sr-only"
            />
            <span className="relative w-11 h-6 border-[1.5px] border-ink bg-paper transition-colors peer-checked:bg-violet peer-focus-visible:ring-2 peer-focus-visible:ring-violet after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-[17px] after:h-[17px] after:bg-ink after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-paper" />
            <span className="text-[14px] text-ink">
              {mb ? "Pay from my own Tab" : "Pay with my wallet"}{" "}
              <span className="text-ink-2 text-[12px]">{mb ? "(Solana wallet signs each pay_for_call)" : "(one USDC signature per agent)"}</span>
            </span>
          </label>
        </div>

        {mb && useUserWallet && (
          <div className="mt-4">
            <MagicBlockTabPanel />
          </div>
        )}

        {statusMessage && (
          <div className={`mt-4 font-mono text-[12px] flex items-center gap-2 ${fatalError ? "text-flame" : "text-ink-2"}`}>
            <span className={`w-2 h-2 ${fatalError ? "bg-flame" : "bg-moss"} ${isRunning ? "animate-blink" : ""}`} />
            {statusMessage}
          </div>
        )}

        {/* Dispatch log & answer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Receipt-style log */}
          <div>
            <div className="kicker mb-2 flex items-center justify-between">
              <span>3. Dispatch log</span>
              {isRunning && <span className="text-moss normal-case tracking-normal">● streaming</span>}
            </div>
            <div
              ref={logsContainerRef}
              data-lenis-prevent
              className="relative bg-paper border-[1.5px] border-ink p-5 min-h-[300px] max-h-[440px] overflow-y-auto font-mono text-[12px] scrollbar-dark"
            >
              {steps.length === 0 && !fatalError ? (
                <div className="text-ink-3 text-[12px] py-14 text-center leading-relaxed">
                  Nothing dispatched yet.
                  <br />
                  Each agent will be verified, paid, run and rated — one line item at a time.
                </div>
              ) : (
                <div>
                  {steps.map((s, idx) => (
                    <div key={idx} className="animate-fadeIn py-3 border-b border-dashed border-ink/30 last:border-b-0 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-ink">
                          {String(idx + 1).padStart(2, "0")} · {s.agentName}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wider px-1.5 border ${
                            s.state === "done"
                              ? "border-moss text-moss"
                              : s.state === "failed"
                              ? "border-flame text-flame"
                              : "border-ink/30 text-ink-3 animate-pulse"
                          }`}
                        >
                          {s.state === "signing" ? "queued" : s.state}
                          {s.durationMs ? ` ${(s.durationMs / 1000).toFixed(1)}s` : ""}
                        </span>
                      </div>
                      {s.trust && (
                        <div className="text-ink-2">
                          {s.trust.active ? "✓ registered" : "✗ unregistered"} · stake{" "}
                          {s.trust.stakeUSDC === null ? "—" : `${s.trust.stakeUSDC} ${mb ? "tUSDC" : "USDC"}`} · indep{" "}
                          {s.trust.independent ? splitLabel(s.trust.independent) : "—"} · operator{" "}
                          {s.trust.operator ? splitLabel(s.trust.operator) : "—"}
                        </div>
                      )}
                      {s.payee && (
                        <div className="flex items-center gap-2">
                          <span className="text-ink-3 w-20 shrink-0">payee</span>
                          <a
                            href={mb ? `https://explorer.solana.com/address/${s.payee}?cluster=devnet` : `${EXPLORER}/address/${s.payee}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-ink hover:underline truncate"
                          >
                            {s.payee.slice(0, 6)}…{s.payee.slice(-4)} ↗
                          </a>
                        </div>
                      )}
                      {mb && s.erSig && <TxLink label="ER payment" hash={s.erSig} url={s.erUrl} suffix={s.confirmMs !== undefined ? `${s.confirmMs} ms` : undefined} />}
                      {mb && s.receiptPda && (
                        <div className="flex items-center gap-2">
                          <span className="text-ink-3 w-20 shrink-0">receipt</span>
                          <span className="text-ink truncate" title="Ephemeral account on the ER; closed by its review">
                            {s.receiptPda.slice(0, 6)}…{s.receiptPda.slice(-4)} (ephemeral)
                          </span>
                        </div>
                      )}
                      {!mb && s.payment && (
                        <div className="flex items-start gap-2">
                          <span className="text-ink-3 w-20 shrink-0">payment</span>
                          {s.payment.status === "settled" ? (
                            <a href={`${EXPLORER}/tx/${s.payment.txHash}`} target="_blank" rel="noreferrer" className="text-moss hover:underline truncate">
                              USDC settled {shortHash(s.payment.txHash)} ↗
                            </a>
                          ) : (
                            <span className="text-flame" title={s.payment.reason}>
                              signed · settlement {s.payment.status}
                            </span>
                          )}
                        </div>
                      )}
                      <TxLink label="recorded" hash={s.recordTx} />
                      {s.state === "done" && s.payment && !s.callId && (
                        <div className="text-ink-3">no paid call recorded (payment not settled) — not reviewable</div>
                      )}
                      <TxLink label="op. review" hash={s.feedbackTx} url={s.feedbackUrl} />
                      {s.score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-ink-3 w-20 shrink-0">score</span>
                          <span className="px-1.5 bg-sun text-ink font-semibold">{s.score}/100 operator</span>
                        </div>
                      )}
                      {useUserWallet && s.callId && s.state === "done" && (
                        <div className="text-violet">rate this call on its field report below ↓</div>
                      )}
                      {s.error && <div className="text-flame">{s.error}</div>}
                    </div>
                  ))}
                  {fatalError && <div className="text-flame font-semibold pt-3">{fatalError}</div>}
                  {mb && settlement && (
                    <div className="mt-3 border-t-[1.5px] border-ink pt-3 space-y-1">
                      <div className="kicker">Settlement to Solana</div>
                      {settlement.state === "waiting" && (
                        <div className="text-ink-2 animate-pulse">waiting for the next checkpoint (every 20 calls, or 60 s via the ER crank)…</div>
                      )}
                      {settlement.state === "timeout" && <div className="text-flame">no new checkpoint observed within 150 s — check /api/magicblock/metrics</div>}
                      {settlement.commit && <TxLink label="commit" hash={settlement.commit.signature} url={settlement.commit.explorerUrl} />}
                      {settlement.payouts?.map((p) => (
                        <TxLink key={p.agentId} label={`payout #${p.agentId}`} hash={p.signature} url={p.url} suffix={`+${(p.paidTotalUnits / 1e6).toFixed(3)} tUSDC since this run started`} />
                      ))}
                      {settlement.state === "landed" && !settlement.payouts?.length && <div className="text-ink-2">commit landed; payout actions pending…</div>}
                    </div>
                  )}
                  {!mb && steps.some((s) => s.payment?.status === "unfunded") && (
                    <div className="mt-3 text-[11px] text-ink-2 leading-relaxed border border-ink/30 bg-sun-soft p-2.5">
                      The payer holds no testnet USDC, so payments are signed and verified but not transferred. Fund it at faucet.circle.com
                      and the same flow settles real USDC.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Answer column */}
          <div className="flex flex-col">
            <div className="kicker mb-2">4. The answer</div>
            <div className="relative flex-1 border-[1.5px] border-ink bg-paper p-6 min-h-[300px] flex flex-col">
              {synthesizedAnswer ? (
                <div className="text-[16px] leading-relaxed text-ink whitespace-pre-wrap animate-fadeIn first-letter:font-display first-letter:text-5xl first-letter:float-left first-letter:mr-2 first-letter:leading-[0.8]">
                  {synthesizedAnswer}
                  {isRunning && <span className="inline-block w-2 h-4 bg-ink ml-1 align-middle animate-blink" />}
                </div>
              ) : (
                <div className="m-auto text-center text-ink-3 max-w-xs">
                  <div className="font-display italic text-3xl text-ink-2 mb-2">Awaiting copy.</div>
                  <p className="text-[13px] leading-relaxed">The summary from every verified specialist will be set here once the run completes.</p>
                </div>
              )}
              {synthesizedAnswer && (
                <div className="mt-auto pt-5 border-t border-ink/20 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-2">
                  <span>Deterministic · no LLM in the path</span>
                  <span>{runs.length} agents · {mb ? "paid on MagicBlock ER" : "Monad 10143"}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <AgentResultCards runs={runs} />
      </div>
    </div>
  );
};
