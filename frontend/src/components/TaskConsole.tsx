"use client";

import React, { useState, useEffect, useRef } from "react";
import { connectBrowserWallet, signRealX402Payment } from "../lib/wallet";
import { ORCHESTRATOR_ADDRESS } from "../lib/useBalances";
import { useActivityStore } from "../lib/activity-store";
import { MONAD_CONTRACTS } from "../lib/contracts";
import { AgentResultCards, AgentRun } from "./AgentResultCards";
import { getOrchestratorUrl } from "../lib/orchestrator";

interface StepLog {
  agentId: number;
  agentName: string;
  skill: string;
  state: "signing" | "running" | "recording" | "done" | "failed";
  payment?: { status: string; txHash?: string; reason?: string };
  recordTx?: string;
  feedbackTx?: string;
  score?: number;
  durationMs?: number;
  error?: string;
  trust?: { active: boolean; avgScore: number; feedbackCount: number };
}

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
    setStatusMessage("Decomposing task into specialist workflows...");

    const orchestratorUrl = getOrchestratorUrl();
    let payer = orchestratorAddress;

    try {
      // 1. Decompose (includes onchain discovery of community agents)
      const decompRes = await fetch(`${orchestratorUrl}/api/decompose`, {
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

      if (useUserWallet) {
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
          // Mode B: one fresh EIP-3009 authorization per call (unique nonce — never reused)
          let authorization: any;
          if (useUserWallet) {
            setStatusMessage(`[${i + 1}/${subtasks.length}] Sign ${subtask.priceUSDC} USDC for ${subtask.agentName} in your wallet...`);
            authorization = await signRealX402Payment(payer, orchestratorAddress, "1000");
          }

          patchStep(i, { state: "running" });
          setStatusMessage(`[${i + 1}/${subtasks.length}] ${subtask.agentName}: x402 payment → onchain analysis...`);

          const stepRes = await fetch(`${orchestratorUrl}/api/execute-step`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subtask, mode: useUserWallet ? "B" : "A", authorization, clientAddress: payer })
          });
          const stepData = await stepRes.json();
          if (!stepRes.ok) throw new Error(stepData.details || stepData.error || "Subtask execution failed");

          const durationMs = Date.now() - t0;
          const pay = stepData.settlement?.payment;
          const recordTx: string | undefined = stepData.settlement?.recordTxHash;
          const slot =
            subtask.skill === "token-risk-score" ? "riskScore" : subtask.skill === "contract-audit" ? "audit" : subtask.skill === "gas-timing" ? "gasTiming" : subtask.skill;
          accumulated[slot] = stepData.result;
          setRuns((prev) => [...prev, { agentId: subtask.agentId, agentName: subtask.agentName, skill: subtask.skill, result: stepData.result, durationMs }]);
          patchStep(i, { state: "recording", payment: pay && { status: pay.status, txHash: pay.txHash, reason: pay.reason }, recordTx, durationMs });

          if (recordTx) {
            useActivityStore.getState().addActivity({
              type: "x402_payment",
              title: `x402 call · ${subtask.agentName}`,
              description: pay?.settled
                ? `Settled ${pay.amount} via EIP-3009 and recorded the paid call onchain.`
                : `Paid-call recorded onchain. USDC settlement: ${pay?.status ?? "n/a"}${pay?.reason ? ` — ${pay.reason}` : ""}`,
              txHash: recordTx,
              blockNumber: stepData.settlement?.recordBlockNumber,
              timestamp: new Date().toISOString(),
              status: pay?.settled ? "settled" : "confirmed",
              from: payer,
              to: MONAD_CONTRACTS.reputationRegistry,
              contractName: "ReputationRegistry",
              agentId: subtask.agentId,
              agentName: subtask.agentName,
              skill: subtask.skill,
              amount: pay?.settled ? pay.amount : "0 USDC (unsettled)",
              metadata: { paymentTxHash: pay?.txHash, mode: useUserWallet ? "Mode B (Client Signed)" : "Mode A (Autonomous)" }
            });
          }

          // 3. Rate the specialist onchain
          const { score, note } = qualityScore(subtask.skill, stepData.result, durationMs);
          setStatusMessage(`[${i + 1}/${subtasks.length}] Recording onchain feedback for ${subtask.agentName} (${score}/100)...`);
          let feedbackTx: string | undefined;
          try {
            const fbRes = await fetch(`${orchestratorUrl}/api/feedback`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agentId: subtask.agentId, score, note, reviewer: payer })
            });
            const fb = await fbRes.json();
            if (fbRes.ok && fb.txHash) {
              feedbackTx = fb.txHash;
              useActivityStore.getState().addActivity({
                type: "reputation_feedback",
                title: `Reputation feedback · ${subtask.agentName}`,
                description: `Submitted ${score}/100 to ReputationRegistry. New average ${fb.reputation?.avgScore}/100 over ${fb.reputation?.feedbackCount} reviews.`,
                txHash: fb.txHash,
                blockNumber: fb.blockNumber,
                timestamp: new Date().toISOString(),
                status: "confirmed",
                from: payer,
                to: MONAD_CONTRACTS.reputationRegistry,
                contractName: "ReputationRegistry",
                agentId: subtask.agentId,
                agentName: subtask.agentName,
                skill: subtask.skill,
                amount: "0 MON",
                metadata: { scoreGiven: score, note }
              });
            }
          } catch {
            // Feedback is best-effort; the step itself already succeeded
          }

          patchStep(i, { state: "done", feedbackTx, score });
        } catch (stepErr: any) {
          patchStep(i, { state: "failed", error: stepErr.message, durationMs: Date.now() - t0 });
        }
        await sleep(200);
      }

      if (Object.keys(accumulated).length === 0) throw new Error("No specialist returned data.");

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

      setStatusMessage("Completed — every hash below is a real Monad Testnet transaction.");
    } catch (err: any) {
      console.error("Task execution error:", err);
      setFatalError(err.message);
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const payingWith = useUserWallet
    ? `Your wallet (${userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : "Not connected"})`
    : `Orchestrator wallet (${orchestratorAddress.slice(0, 6)}...${orchestratorAddress.slice(-4)})`;

  const TxLink: React.FC<{ label: string; hash?: string }> = ({ label, hash }) =>
    hash ? (
      <div className="flex items-center gap-1.5 text-white/80">
        <span className="text-white/40 w-16 shrink-0">{label}</span>
        <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer" className="text-[#a594ff] hover:text-white hover:underline truncate">
          {shortHash(hash)} ↗
        </a>
      </div>
    ) : null;

  return (
    <div className="w-full">
      {/* Main deck */}
      <div className="clip-chamfer-lg bg-gradient-to-br from-[#ccff00]/50 via-white/10 to-[#836ef9]/40 p-px">
        <div className="clip-chamfer-lg bg-[#0f0f10] p-5 sm:p-8">
          {/* Deck header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5 mb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#ccff00]" />
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">orchestrator://task</span>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-white/45">
              Paying with: <span className="text-[#ccff00]">{payingWith}</span>
            </div>
          </div>

          {/* Prompt input */}
          <div className="relative group">
            <span className="absolute left-4 top-4 font-mono text-[#ccff00] text-sm select-none">&gt;_</span>
            <textarea
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              rows={3}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm sm:text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[#ccff00]/60 focus:shadow-[0_0_0_4px_rgba(204,255,0,0.08)] resize-y font-mono leading-relaxed transition-all"
              placeholder="Describe your DeFi task in natural language..."
            />
          </div>

          {/* Quick prompts */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["Full scan", "Is token 0x534b2f3A21130d7a60830c2Df862319e593943A3 safe, audit contract 0x534b2f3A21130d7a60830c2Df862319e593943A3, track whale liquidity, and tell me if gas is good right now on Monad."],
              ["Audit registry", "Audit contract 0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0 for vulnerabilities"],
              ["Gas now", "What is the current gas timing and congestion on Monad?"],
              ["Whale watch", "Track whale and liquidity moves for 0x534b2f3A21130d7a60830c2Df862319e593943A3"]
            ].map(([label, prompt]) => (
              <button
                key={label}
                onClick={() => setTaskText(prompt)}
                disabled={isRunning}
                className="chip-cyber"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
            <button onClick={handleRunTask} disabled={isRunning || !taskText.trim()} className="btn-neon disabled:opacity-50 disabled:pointer-events-none">
              {isRunning ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-black animate-ping inline-block"></span>
                  <span>Running...</span>
                </>
              ) : (
                <span>Run task</span>
              )}
            </button>

            {/* Wallet mode toggle */}
            <label htmlFor="userWalletCheckbox" className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                id="userWalletCheckbox"
                checked={useUserWallet}
                onChange={(e) => setUseUserWallet(e.target.checked)}
                className="peer sr-only"
              />
              <span className="relative w-11 h-6 rounded-full bg-white/10 border border-white/15 transition-colors peer-checked:bg-[#ccff00]/90 peer-focus-visible:ring-2 peer-focus-visible:ring-[#ccff00] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-[18px] after:h-[18px] after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-black" />
              <span className="font-mono text-xs uppercase tracking-wider text-white/70">
                Run with my wallet <span className="text-white/35 normal-case">(signs one USDC authorization per agent)</span>
              </span>
            </label>
          </div>

          {statusMessage && (
            <div className={`mt-4 font-mono text-xs flex items-center gap-2 ${fatalError ? "text-rose-400" : "text-[#ccff00]/80"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${fatalError ? "bg-rose-400" : "bg-[#ccff00]"} ${isRunning ? "animate-pulse" : ""}`} />
              {statusMessage}
            </div>
          )}

          {/* Live progress & synthesized answer */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8 items-stretch">
            {/* Live progress */}
            <div className="flex flex-col">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3 flex items-center justify-between">
                <span>Live progress</span>
                {isRunning && (
                  <span className="text-[#ccff00] flex items-center gap-1.5 normal-case tracking-normal">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] animate-pulse"></span>
                    Sequential streaming
                  </span>
                )}
              </h3>

              <div
                ref={logsContainerRef}
                data-lenis-prevent
                className="relative bg-black/60 border border-white/10 rounded-xl p-5 min-h-[280px] max-h-[420px] overflow-y-auto font-mono text-xs scrollbar-dark"
              >
                {isRunning && (
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                    <div className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-[#ccff00]/[0.05] to-transparent animate-scan" />
                  </div>
                )}
                {steps.length === 0 && !fatalError ? (
                  <div className="text-white/35 text-xs py-12 text-center flex flex-col items-center justify-center gap-2">
                    <span>Enter a task above and click &quot;Run task&quot; to see live step progress.</span>
                    <span className="text-[11px] text-white/25">Each specialist is verified, paid via x402, executed and rated onchain — one after another.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {steps.map((s, idx) => (
                      <div key={idx} className="animate-fadeIn border-l-2 pl-3 space-y-1" style={{ borderColor: s.state === "failed" ? "#f43f5e" : s.state === "done" ? "#ccff00" : "rgba(255,255,255,0.15)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white">
                            #{s.agentId} {s.agentName}
                          </span>
                          <span
                            className={`text-[10px] uppercase tracking-wider ${
                              s.state === "done" ? "text-[#ccff00]" : s.state === "failed" ? "text-rose-400" : "text-white/40 animate-pulse"
                            }`}
                          >
                            {s.state === "signing" ? "queued" : s.state}
                            {s.durationMs ? ` · ${(s.durationMs / 1000).toFixed(1)}s` : ""}
                          </span>
                        </div>
                        {s.trust && (
                          <div className={s.trust.active ? "text-[#ccff00]/80" : "text-amber-300"}>
                            {s.trust.active ? "[reputation_ok]" : "[unregistered]"} IdentityRegistry {s.trust.active ? "active" : "inactive"}
                            {s.trust.feedbackCount > 0 ? ` · ${s.trust.avgScore}/100 over ${s.trust.feedbackCount} reviews` : " · no reviews yet"}
                          </div>
                        )}
                        {s.payment && (
                          <div className="flex items-start gap-1.5">
                            <span className="text-white/40 w-16 shrink-0">x402</span>
                            {s.payment.status === "settled" ? (
                              <a href={`${EXPLORER}/tx/${s.payment.txHash}`} target="_blank" rel="noreferrer" className="text-[#ccff00] hover:underline truncate">
                                USDC settled {shortHash(s.payment.txHash)} ↗
                              </a>
                            ) : (
                              <span className="text-amber-300/90" title={s.payment.reason}>
                                signature verified · settlement {s.payment.status}
                              </span>
                            )}
                          </div>
                        )}
                        <TxLink label="recorded" hash={s.recordTx} />
                        <TxLink label="feedback" hash={s.feedbackTx} />
                        {s.score !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-white/40 w-16 shrink-0">score</span>
                            <span className="font-bold text-black bg-[#ccff00] px-1.5 py-0.5 rounded">{s.score}/100</span>
                          </div>
                        )}
                        {s.error && <div className="text-rose-400">{s.error}</div>}
                      </div>
                    ))}
                    {fatalError && <div className="text-rose-400 font-semibold">{fatalError}</div>}
                    {steps.some((s) => s.payment?.status === "unfunded") && (
                      <div className="text-[11px] text-amber-200/70 leading-relaxed border border-amber-300/20 bg-amber-300/[0.04] rounded p-2.5">
                        The payer wallet holds no testnet USDC, so payments are verified but not transferred. Fund it at faucet.circle.com (Monad Testnet) and the same flow settles real USDC onchain.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Synthesized answer */}
            <div className="flex flex-col">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3">Synthesized answer</h3>

              <div className="relative flex-1 rounded-xl p-6 min-h-[280px] flex flex-col justify-between border border-[#836ef9]/30 bg-gradient-to-br from-[#836ef9]/[0.12] via-black/40 to-[#ccff00]/[0.05] overflow-hidden">
                {synthesizedAnswer ? (
                  <div className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap animate-fadeIn">
                    {synthesizedAnswer}
                    {isRunning && <span className="inline-block w-2 h-4 bg-[#ccff00] ml-1 align-middle animate-pulse"></span>}
                  </div>
                ) : (
                  <div className="text-white/35 text-sm py-12 text-center flex flex-col items-center justify-center gap-4">
                    <span className="w-12 h-12 clip-chamfer border border-dashed border-white/20 flex items-center justify-center font-display text-white/30">AI</span>
                    <span>Synthesized summary from all verified specialists will appear here after task completion.</span>
                  </div>
                )}

                {synthesizedAnswer && (
                  <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-wider">
                    <span className="text-[#ccff00] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] inline-block"></span>
                      Deterministic · zero LLM in the path
                    </span>
                    <span className="text-white/40">{runs.length} agents · Monad 10143</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <AgentResultCards runs={runs} />
        </div>
      </div>
    </div>
  );
};
