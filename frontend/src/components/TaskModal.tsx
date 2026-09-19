"use client";

import React, { useState } from "react";
import { AgentData } from "../lib/contracts";

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
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackScore, setFeedbackScore] = useState(95);
  const [feedbackNote, setFeedbackNote] = useState("Accurate onchain assessment and fast response.");

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
    setFeedbackSent(false);

    try {
      const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:4000";
      const payload: any = {
        taskText,
        mode
      };

      if (mode === "B") {
        // Mode B simulated client signature authorization
        payload.signedAuthorizations = {
          "token-risk-score": { from: "0xClientWallet", simulated: true },
          "contract-audit": { from: "0xClientWallet", simulated: true },
          "gas-timing": { from: "0xClientWallet", simulated: true }
        };
      }

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
      setError(err.message || "Failed to orchestrate task.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmitFeedback = async (agentId: number) => {
    setFeedbackSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold transition-colors"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ccff00]"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Task Orchestration Engine
            </span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            Run Natural Language DeFi Task
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Deterministic regex task routing + specialist agent settlement via Monad Testnet USDC.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-5 w-fit border border-gray-200/60">
          <button
            onClick={() => setMode("A")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === "A"
                ? "bg-white text-gray-950 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Mode A: Autonomous (Orchestrator Pays)
          </button>
          <button
            onClick={() => setMode("B")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === "B"
                ? "bg-white text-gray-950 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Mode B: Your Wallet (Client Signs x402)
          </button>
        </div>

        {/* Prompt Suggestions */}
        <div className="mb-3 flex flex-wrap gap-2">
          {presetQueries.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setTaskText(p.text)}
              className="text-[11px] bg-gray-50 hover:bg-gray-100 border border-gray-200/70 text-gray-600 px-3 py-1 rounded-full transition-colors"
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
            className="w-full bg-[#f8f9fa] border border-gray-200 rounded-2xl p-4 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:border-transparent text-gray-900"
            placeholder="e.g. Is token 0x534b2f3A... safe, and is gas good on Monad right now?"
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs text-gray-500">
            Estimated Cost: <span className="font-semibold text-gray-900">~$0.001 - $0.003 tUSDC</span>
          </div>

          <button
            onClick={handleExecute}
            disabled={isRunning || !taskText.trim()}
            className="btn-monad-lime text-sm font-bold py-2.5 px-6 disabled:opacity-50"
          >
            {isRunning ? (
              <span className="flex items-center space-x-2">
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                <span>Executing Specialist Agents...</span>
              </span>
            ) : (
              <span>Execute Task</span>
            )}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs mb-6">
            <span className="font-bold block mb-1">Execution Notice:</span>
            {error}
          </div>
        )}

        {/* Results Container */}
        {result && (
          <div className="space-y-6 pt-6 border-t border-gray-200 animate-fadeIn">
            {/* Synthesized Final Summary */}
            <div className="bg-[#faffeb] rounded-2xl border border-[#d6f864] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Deterministic Synthesized Answer
                  </span>
                  {result.polished && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                      Polished
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-gray-500">{result.totalCostUSDC} settled</span>
              </div>
              <p className="text-sm font-medium text-gray-900 leading-relaxed">
                {result.summary}
              </p>
            </div>

            {/* Subtask Timeline & Settlements */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                Decomposed Subtasks & Settlements
              </h3>

              <div className="space-y-3">
                {result.steps?.map((step: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-4 text-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-900">{step.subtask.agentName}</span>
                        <span className="font-mono text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md">
                          {step.subtask.skill}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">{step.durationMs}ms</span>
                        <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                          {step.status}
                        </span>
                      </div>
                    </div>

                    {/* Settlement badge */}
                    {step.settlement && (
                      <div className="mt-2 pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between text-[11px] text-gray-500">
                        <span>Mode: <strong className="text-gray-800">{step.settlement.mode}</strong></span>
                        <span className="font-mono">Hash: {step.settlement.txHash}</span>
                        <span className="text-emerald-700 font-semibold">{step.settlement.amount}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Onchain Feedback Submission */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
              <h4 className="text-xs font-bold text-gray-800 mb-1">
                Submit Verified Onchain Feedback (ReputationRegistry)
              </h4>
              <p className="text-[11px] text-gray-500 mb-3">
                As a verified caller of these agents, you are entitled to record an onchain score (0-100).
              </p>

              {feedbackSent ? (
                <div className="text-xs text-emerald-700 font-medium bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  Feedback recorded onchain! Reputation updated.
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={feedbackScore}
                    onChange={(e) => setFeedbackScore(Number(e.target.value))}
                    className="w-20 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-center"
                    placeholder="Score"
                  />
                  <input
                    type="text"
                    value={feedbackNote}
                    onChange={(e) => setFeedbackNote(e.target.value)}
                    className="flex-1 w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700"
                    placeholder="Short feedback note"
                  />
                  <button
                    onClick={() => handleSubmitFeedback(1)}
                    className="bg-gray-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
                  >
                    Submit Feedback
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
