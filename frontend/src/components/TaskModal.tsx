"use client";

import React, { useState, useEffect } from "react";
import { AgentData } from "../lib/contracts";
import { connectBrowserWallet, signRealX402Payment } from "../lib/wallet";
import { ORCHESTRATOR_ADDRESS } from "../lib/useBalances";
import { getOrchestratorUrl } from "../lib/orchestrator";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  agents: AgentData[];
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  initialPrompt = "",
  agents
}) => {
  const [taskText, setTaskText] = useState(initialPrompt || "Is token 0x534b2f3A21130d7a60830c2Df862319e593943A3 safe, and is gas good on Monad right now?");
  const [mode, setMode] = useState<"A" | "B">("A");
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [signingStatus, setSigningStatus] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<any>(null);
  const [feedbackScore, setFeedbackScore] = useState(98);
  const [feedbackNote, setFeedbackNote] = useState("Accurate onchain assessment verified on Monad Testnet.");

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      (window as any).ethereum.request({ method: "eth_accounts" }).then((accs: string[]) => {
        if (accs && accs.length > 0) setUserAddress(accs[0]);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const presetQueries = [
    { label: "Token Risk + Gas Check", text: "Is token 0x534b2f3A21130d7a60830c2Df862319e593943A3 safe, and is gas good on Monad right now?" },
    { label: "Security Audit", text: "Audit contract 0x534b2f3A21130d7a60830c2Df862319e593943A3 for security bugs and reentrancy" },
    { label: "Live Monad Gas", text: "Check current gas price and transaction timing recommendation on Monad Testnet" }
  ];

  const handleExecute = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setFeedbackResult(null);
    setSigningStatus(null);

    try {
      const orchestratorUrl = getOrchestratorUrl();

      const authorizations: any[] = [];

      if (mode === "B") {
        let currentAddress = userAddress;
        if (!currentAddress) {
          setSigningStatus("Connecting MetaMask wallet...");
          const wallet = await connectBrowserWallet();
          currentAddress = wallet.address;
          setUserAddress(wallet.address);
        }

        const payTo = ORCHESTRATOR_ADDRESS;

        // One authorization per subtask, in the same order /api/orchestrate executes them (unique nonces)
        const decomp = await fetch(`${orchestratorUrl}/api/decompose`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskText })
        }).then((r) => r.json());
        const coreSubtasks = (decomp.subtasks || []).filter((s: any) => s.agentId <= 3);

        for (let i = 0; i < coreSubtasks.length; i++) {
          setSigningStatus(`Confirm x402 payment ${i + 1}/${coreSubtasks.length} ($0.001 USDC) for ${coreSubtasks[i].agentName} in your wallet...`);
          authorizations.push(await signRealX402Payment(currentAddress, payTo, "1000"));
        }
        setSigningStatus("Authorizations signed! Executing specialist agents and broadcasting onchain...");
      } else {
        setSigningStatus("Mode A: Orchestrator is cryptographically signing and settling on Monad Testnet...");
      }

      const payload: any = { taskText, mode, authorizations: mode === "B" ? authorizations : undefined };

      const res = await fetch(`${orchestratorUrl}/api/orchestrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }

      setResult(json);
    } catch (err: any) {
      console.error("Task execution failed:", err);
      setError(err.message || "Failed to orchestrate task.");
    } finally {
      setIsRunning(false);
      setSigningStatus(null);
    }
  };

  const handleSubmitFeedback = async () => {
    try {
      setSubmittingFeedback(true);
      const orchestratorUrl = getOrchestratorUrl();
      const res = await fetch(`${orchestratorUrl}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: 1,
          score: feedbackScore,
          note: feedbackNote,
          reviewer: userAddress || ORCHESTRATOR_ADDRESS
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error);
      setFeedbackResult(data);
    } catch (err: any) {
      console.error("Feedback error:", err);
      alert(`Could not broadcast feedback onchain: ${err.message}`);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-paper-card rounded-none border border-ink/20 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-9 h-9 rounded-full bg-paper-shade hover:bg-paper-deep flex items-center justify-center text-ink-2 font-bold transition-colors"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sun"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
              Task Orchestration Engine
            </span>
          </div>
          <h2 className="text-2xl font-black text-ink tracking-tight">
            Run Natural Language DeFi Task
          </h2>
          <p className="text-xs text-ink-2 mt-1">
            Real onchain agent execution with real EIP-712 signed x402 testnet USDC micropayments.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex bg-paper-shade p-1 rounded-none mb-5 w-fit border border-ink/20">
          <button
            onClick={() => setMode("A")}
            className={`px-4 py-2 rounded-none text-xs font-bold transition-all ${
              mode === "A"
                ? "bg-paper-card text-ink shadow-sm"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            Mode A: Autonomous (Orchestrator Signs & Pays)
          </button>
          <button
            onClick={() => setMode("B")}
            className={`px-4 py-2 rounded-none text-xs font-bold transition-all ${
              mode === "B"
                ? "bg-paper-card text-ink shadow-sm"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            Mode B: Your Wallet (MetaMask Real EIP-712 Sign)
          </button>
        </div>

        {/* Mode Description Notice */}
        <div className="mb-4 text-xs text-ink-2 bg-paper p-3 rounded-none border border-ink/20">
          {mode === "A" ? (
            <span>
              <strong>Mode A</strong>: The orchestrator uses its Monad Testnet wallet to generate a real cryptographic EIP-712 signature and broadcasts settlement onchain to Monad Testnet.
            </span>
          ) : (
            <span>
              <strong>Mode B</strong>: MetaMask will pop up prompting you to sign an authentic EIP-712 Typed Data transfer authorization for $0.001 USDC on Monad Testnet.
            </span>
          )}
        </div>

        {/* Prompt Suggestions */}
        <div className="mb-3 flex flex-wrap gap-2">
          {presetQueries.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setTaskText(p.text)}
              className="text-[11px] bg-paper hover:bg-sun-soft border border-ink/20 text-ink-2 px-3 py-1 rounded-full transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <div className="mb-5">
          <textarea
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            rows={3}
            className="w-full bg-paper border border-ink/20 rounded-none p-4 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-violet focus:border-transparent text-ink"
            placeholder="e.g. Is token 0x534b2f3A... safe, and is gas good on Monad right now?"
          />
        </div>

        {/* Action Button & Signing Indicator */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="text-xs text-ink-2">
            {signingStatus ? (
              <span className="text-moss font-medium flex items-center space-x-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-moss"></span>
                <span>{signingStatus}</span>
              </span>
            ) : (
              <span>Estimated Cost: <strong className="text-ink">~$0.001 - $0.003 tUSDC</strong> (100% Real Monad Data)</span>
            )}
          </div>

          <button
            onClick={handleExecute}
            disabled={isRunning || !taskText.trim()}
            className="btn-neon btn-sm text-sm font-bold py-2.5 px-6 disabled:opacity-50 w-full sm:w-auto"
          >
            {isRunning ? (
              <span className="flex items-center space-x-2">
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                <span>Broadcasting to Monad Testnet...</span>
              </span>
            ) : (
              <span>Execute Real Task</span>
            )}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-none bg-red-50 border border-red-200 text-red-700 text-xs mb-6">
            <span className="font-bold block mb-1">Execution Notice:</span>
            {error}
          </div>
        )}

        {/* Results Container */}
        {result && (
          <div className="space-y-6 pt-6 border-t border-ink/20 animate-fadeIn">
            {/* Synthesized Final Summary */}
            <div className="bg-[#faffeb] rounded-none border border-[#d6f864] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-moss">
                    Real Synthesized Output from Monad Agents
                  </span>
                  <span className="text-[10px] bg-moss-soft text-moss px-2 py-0.5 rounded-full font-medium">
                    100% Real Monad Data
                  </span>
                </div>
                <span className="text-xs font-mono text-ink-2">{result.totalCostUSDC} settled</span>
              </div>
              <p className="text-sm font-medium text-ink leading-relaxed">
                {result.summary}
              </p>
            </div>

            {/* Subtask Timeline & Settlements */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-3 mb-3">
                Decomposed Subtasks & Live Block Explorer Transactions
              </h3>

              <div className="space-y-3">
                {result.steps?.map((step: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-paper border border-ink/20 rounded-none p-4 text-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-ink">{step.subtask.agentName}</span>
                        <span className="font-mono text-[10px] bg-paper-shade text-ink px-2 py-0.5 rounded-md">
                          {step.subtask.skill}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-ink-3">{step.durationMs}ms</span>
                        <span className="font-bold text-moss bg-moss-soft px-2 py-0.5 rounded-full text-[10px]">
                          {step.status}
                        </span>
                      </div>
                    </div>

                    {/* Settlement & Explorer Badge */}
                    {step.settlement && (
                      <div className="mt-2 pt-2 border-t border-ink/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-2">
                        <span>Status: <strong className="text-moss">Mined Onchain</strong></span>
                        <a
                          href={`https://testnet.monadvision.com/tx/${step.settlement.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-moss hover:underline font-bold flex items-center space-x-1"
                        >
                          <span>Tx: {step.settlement.txHash?.slice(0, 14)}... ↗</span>
                        </a>
                        <span className="text-moss font-semibold bg-moss-soft px-2 py-0.5 rounded border border-moss/40">
                          {step.settlement.amount}
                        </span>
                      </div>
                    )}

                    {/* Real Agent JSON Data Dropdown / Inspection */}
                    {step.result && (
                      <details className="mt-2 pt-2 border-t border-ink/20">
                        <summary className="cursor-pointer text-[10px] font-bold text-ink-2 hover:text-ink">
                          View Raw Live RPC Response Data ({step.subtask.skill})
                        </summary>
                        <pre className="mt-2 p-3 bg-paper-card rounded-lg border border-ink/20 text-[10px] font-mono text-ink overflow-x-auto">
                          {JSON.stringify(step.result, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Onchain Feedback Submission */}
            <div className="bg-paper border border-ink/20 rounded-none p-5">
              <h4 className="text-xs font-bold text-ink mb-1">
                Submit Verified Onchain Feedback (ReputationRegistry)
              </h4>
              <p className="text-[11px] text-ink-2 mb-3">
                Broadcasting feedback sends an onchain transaction directly to contract 0x7b39...Ba8C on Monad Testnet.
              </p>

              {feedbackResult ? (
                <div className="text-xs text-moss font-medium bg-moss-soft p-3 rounded-none border border-moss/40 space-y-1">
                  <div className="font-bold">Transaction Mined on Monad Testnet (Block #{feedbackResult.blockNumber})!</div>
                  <a
                    href={feedbackResult.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[11px] text-moss hover:underline block font-semibold"
                  >
                    View Feedback Tx on MonadVision: {feedbackResult.txHash?.slice(0, 20)}... ↗
                  </a>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={feedbackScore}
                    onChange={(e) => setFeedbackScore(Number(e.target.value))}
                    className="w-20 bg-paper-card border border-ink/20 rounded-none px-3 py-1.5 text-xs font-bold text-center"
                    placeholder="Score"
                  />
                  <input
                    type="text"
                    value={feedbackNote}
                    onChange={(e) => setFeedbackNote(e.target.value)}
                    className="flex-1 w-full bg-paper-card border border-ink/20 rounded-none px-3 py-1.5 text-xs text-ink"
                    placeholder="Short feedback note"
                  />
                  <button
                    onClick={handleSubmitFeedback}
                    disabled={submittingFeedback}
                    className="bg-paper-shade hover:bg-paper-deep text-ink text-xs font-bold px-4 py-2 rounded-none transition-all disabled:opacity-50"
                  >
                    {submittingFeedback ? "Broadcasting Tx..." : "Submit Feedback Onchain"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
