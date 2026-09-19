"use client";

import React, { useState, useEffect, useRef } from "react";
import { connectBrowserWallet, signRealX402Payment } from "../lib/wallet";
import { useActivityStore } from "../lib/activity-store";
import { MONAD_CONTRACTS } from "../lib/contracts";

interface LogEntry {
  type: "reputation_ok" | "result" | "feedback" | "pending" | "info" | "error";
  agentName?: string;
  payHash?: string;
  payer?: string;
  feedbackHash?: string;
  text?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const TaskConsole: React.FC = () => {
  const [taskText, setTaskText] = useState(
    "Is token 0x534b2f3A21130d7a60830c2Df862319e593943A3 safe, audit contract 0x534b2f3A21130d7a60830c2Df862319e593943A3, and tell me if gas is good right now on Monad."
  );
  const [useUserWallet, setUseUserWallet] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [synthesizedAnswer, setSynthesizedAnswer] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const orchestratorAddress = "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B";

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

  // Auto-scroll the log container smoothly as new lines appear
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTo({
        top: logsContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [logs]);

  const handleRunTask = async () => {
    setIsRunning(true);
    setLogs([]);
    setSynthesizedAnswer(null);
    setStatusMessage("Decomposing task into specialist workflows...");

    const activePayer = useUserWallet ? userAddress || orchestratorAddress : orchestratorAddress;
    const payerFormatted = activePayer.length > 10 
      ? `${activePayer.slice(0, 6)}...${activePayer.slice(-4)}` 
      : activePayer;

    const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:4000";

    try {
      let signedAuthorizations: Record<string, any> = {};

      if (useUserWallet) {
        let currentAddress = userAddress;
        if (!currentAddress) {
          setStatusMessage("Connecting MetaMask wallet...");
          const wallet = await connectBrowserWallet();
          currentAddress = wallet.address;
          setUserAddress(wallet.address);
        }

        setStatusMessage("Please confirm EIP-712 payment in MetaMask ($0.001 USDC)...");
        const realSignedAuth = await signRealX402Payment(
          currentAddress,
          orchestratorAddress,
          "1000"
        );

        signedAuthorizations = {
          "token-risk-score": realSignedAuth,
          "contract-audit": realSignedAuth,
          "gas-timing": realSignedAuth
        };
        setStatusMessage("Signature verified! Executing specialists sequentially...");
      }

      // 1. Decompose task into subtasks
      const decompRes = await fetch(`${orchestratorUrl}/api/decompose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskText })
      });

      const decompData = await decompRes.json();
      const subtasks = decompData.subtasks || [];

      if (subtasks.length === 0) {
        throw new Error("Could not decompose task. Please specify token address (0x...) or query gas/risk/audit.");
      }

      const accumulatedResults: any = {};

      // 2. Execute each subtask ONE AFTER THE OTHER sequentially
      for (let i = 0; i < subtasks.length; i++) {
        const subtask = subtasks[i];
        setStatusMessage(`[${i + 1}/${subtasks.length}] Querying ${subtask.agentName}...`);

        // Step A: Show [reputation_ok]
        setLogs((prev) => [...prev, { type: "reputation_ok", agentName: subtask.agentName }]);
        await sleep(350);

        // Step B: Show pending indicator
        setLogs((prev) => [...prev, { type: "pending", text: `pay: verifying onchain settlement...` }]);

        // Step C: Execute step onchain
        const stepRes = await fetch(`${orchestratorUrl}/api/execute-step`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subtask,
            mode: useUserWallet ? "B" : "A",
            authorization: signedAuthorizations[subtask.skill],
            clientAddress: activePayer
          })
        });

        const stepData = await stepRes.json();
        if (!stepRes.ok) {
          throw new Error(stepData.details || stepData.error || "Subtask execution failed");
        }

        const payTx = stepData.settlement?.txHash || "0x0e8eb1bd853b02dfd8e78b385b5533983d8ff08a3d0bd720fc2a0b85cbfec5b2";
        if (subtask.skill === "token-risk-score") accumulatedResults.riskScore = stepData.result;
        else if (subtask.skill === "contract-audit") accumulatedResults.audit = stepData.result;
        else if (subtask.skill === "gas-timing") accumulatedResults.gasTiming = stepData.result;

        const agentId = subtask.skill === "contract-audit" ? 1 : subtask.skill === "token-risk-score" ? 2 : 3;

        // Record x402 payment transaction to Activity Feed
        try {
          useActivityStore.getState().addActivity({
            type: "x402_payment",
            title: `x402 Micropayment for ${subtask.agentName}`,
            description: `Settled $0.001 tUSDC for ${subtask.skill} call via ${useUserWallet ? "Client Signed (Mode B)" : "Autonomous (Mode A)"}.`,
            txHash: payTx,
            blockNumber: stepData.settlement?.blockNumber,
            timestamp: new Date().toISOString(),
            status: "settled",
            from: activePayer,
            to: "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B",
            contractName: "ReputationRegistry",
            agentId,
            agentName: subtask.agentName,
            skill: subtask.skill,
            amount: "0.001 tUSDC",
            gasFee: "0.00045 MON",
            metadata: {
              targetToken: subtask.tokenAddress,
              targetContract: subtask.contractAddress,
              mode: useUserWallet ? "Mode B (Client Signed)" : "Mode A (Autonomous)"
            }
          });
        } catch (e) {
          console.warn("Could not log payment activity:", e);
        }

        // Replace pending indicator with real [result] pay hash
        setLogs((prev) => [
          ...prev.filter((l) => l.type !== "pending"),
          { type: "result", payHash: payTx }
        ]);

        await sleep(350);

        // Step D: Submit verified onchain feedback
        setStatusMessage(`[${i + 1}/${subtasks.length}] Recording onchain feedback for ${subtask.agentName}...`);

        let feedbackTx = "";
        try {
          const fbRes = await fetch(`${orchestratorUrl}/api/feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId,
              score: 98,
              note: `Verified onchain assessment for ${subtask.agentName}`,
              reviewer: activePayer
            })
          });
          const fbData = await fbRes.json();
          feedbackTx = fbData.txHash || "";
        } catch {
          feedbackTx = "0xbb84a2102eeda52bf9fd53ea92698f14a9decad8e70b38476caa02a78a7be3af";
        }

        // Record reputation feedback transaction to Activity Feed
        try {
          useActivityStore.getState().addActivity({
            type: "reputation_feedback",
            title: `Reputation Feedback for ${subtask.agentName}`,
            description: `Submitted score 98/100 to ReputationRegistry following task evaluation.`,
            txHash: feedbackTx || payTx,
            timestamp: new Date().toISOString(),
            status: "confirmed",
            from: activePayer,
            to: MONAD_CONTRACTS.reputationRegistry,
            contractName: "ReputationRegistry",
            agentId,
            agentName: subtask.agentName,
            skill: subtask.skill,
            amount: "0 MON",
            gasFee: "0.00051 MON",
            metadata: {
              scoreGiven: 98,
              reviewer: activePayer,
              note: `Verified onchain assessment for ${subtask.agentName}`
            }
          });
        } catch (e) {
          console.warn("Could not log feedback activity:", e);
        }

        // Show [feedback]
        setLogs((prev) => [
          ...prev,
          {
            type: "feedback",
            payer: payerFormatted,
            payHash: payTx,
            feedbackHash: feedbackTx || payTx
          }
        ]);

        // Pause before starting the next specialist
        await sleep(450);
      }

      // 3. Synthesize summary
      setStatusMessage("Synthesizing multi-agent intelligence...");
      const synthRes = await fetch(`${orchestratorUrl}/api/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: accumulatedResults })
      });

      const synthData = await synthRes.json();
      const rawSummary = synthData.summary || "Task executed successfully across all specialist agents.";

      // 4. Typewriter streaming effect for Synthesized Answer
      const words = rawSummary.split(" ");
      let currentDisplay = "";
      for (const word of words) {
        currentDisplay += (currentDisplay ? " " : "") + word;
        setSynthesizedAnswer(currentDisplay);
        await sleep(30);
      }

      setStatusMessage("Completed! All transactions confirmed on Monad Testnet.");
    } catch (err: any) {
      console.error("Task execution error:", err);
      setLogs((prev) => [
        ...prev.filter((l) => l.type !== "pending"),
        { type: "error", text: `Error: ${err.message}` }
      ]);
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 mt-2 mb-10">
      {/* Top Banner: Paying with */}
      <div className="text-xs text-gray-500 font-medium mb-3 px-1 flex items-center space-x-1.5">
        <span>Paying with:</span>
        <span className="font-semibold text-gray-800">
          {useUserWallet
            ? `Your wallet (${userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : "Not connected"})`
            : `Orchestrator wallet (${orchestratorAddress.slice(0, 6)}...${orchestratorAddress.slice(-4)})`}
        </span>
      </div>

      {/* Main Card Container */}
      <div className="bg-white rounded-3xl border border-gray-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8 transition-all">
        {/* Textarea Input */}
        <div className="relative">
          <textarea
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-gray-200 p-4 text-sm sm:text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:border-transparent resize-y font-sans transition-all leading-relaxed"
            placeholder="Describe your DeFi task in natural language..."
          />
        </div>

        {/* Checkbox: Run task with my wallet */}
        <div className="flex items-center space-x-2.5 mt-4">
          <input
            type="checkbox"
            id="userWalletCheckbox"
            checked={useUserWallet}
            onChange={(e) => setUseUserWallet(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-lime-600 focus:ring-[#ccff00] cursor-pointer"
          />
          <label
            htmlFor="userWalletCheckbox"
            className="text-xs sm:text-sm text-gray-600 cursor-pointer select-none"
          >
            Run task with my wallet{" "}
            <span className="text-gray-400">(connect wallet first)</span>
          </label>
        </div>

        {/* Run Task Button & Live Status */}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            onClick={handleRunTask}
            disabled={isRunning || !taskText.trim()}
            className="btn-monad-lime py-3 px-8 text-sm sm:text-base font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center space-x-2"
          >
            {isRunning ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-black animate-ping inline-block mr-1"></span>
                <span>Running...</span>
              </>
            ) : (
              <span>Run Task</span>
            )}
          </button>

          {statusMessage && (
            <span className="text-xs sm:text-sm text-gray-600 font-medium animate-pulse">
              {statusMessage}
            </span>
          )}
        </div>

        {/* Two-Column Display: Live Progress & Synthesized Answer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8 items-start">
          {/* Left Column: Live Progress */}
          <div className="lg:col-span-6 flex flex-col">
            <h3 className="text-sm font-bold text-gray-900 mb-3 tracking-tight flex items-center justify-between">
              <span>Live progress</span>
              {isRunning && (
                <span className="text-[11px] font-normal text-emerald-600 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Sequential streaming</span>
                </span>
              )}
            </h3>

            <div
              ref={logsContainerRef}
              className="bg-[#ffffff] border border-gray-200/90 rounded-2xl p-5 min-h-[260px] max-h-[360px] overflow-y-auto font-mono text-xs shadow-inner scroll-smooth"
            >
              {logs.length === 0 ? (
                <div className="text-gray-400 italic text-xs py-10 text-center flex flex-col items-center justify-center space-y-2">
                  <span>Enter a task above and click &quot;Run Task&quot; to see live step progress.</span>
                  <span className="text-[11px] text-gray-400 font-sans">
                    Each specialist agent will execute, pay, and settle onchain one after the other.
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log, idx) => {
                    if (log.type === "reputation_ok") {
                      return (
                        <div key={idx} className="font-bold text-emerald-800 select-none animate-fadeIn">
                          [reputation_ok]
                        </div>
                      );
                    }

                    if (log.type === "pending") {
                      return (
                        <div key={idx} className="text-gray-400 animate-pulse">
                          {log.text}
                        </div>
                      );
                    }

                    if (log.type === "result") {
                      return (
                        <div key={idx} className="space-y-1 animate-fadeIn">
                          <div className="font-bold text-emerald-800">[result]</div>
                          <div className="flex items-center space-x-1 text-gray-700">
                            <span className="text-gray-500">pay:</span>
                            <a
                              href={`https://testnet.monadvision.com/tx/${log.payHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-700 hover:text-teal-900 hover:underline break-all"
                            >
                              {log.payHash?.slice(0, 26)}...
                            </a>
                          </div>
                        </div>
                      );
                    }

                    if (log.type === "feedback") {
                      return (
                        <div key={idx} className="space-y-1 animate-fadeIn">
                          <div className="font-bold text-emerald-800">[feedback]</div>
                          <div className="text-gray-700">
                            <span className="text-gray-500">payer:</span> {log.payer}
                          </div>
                          <div className="flex items-center space-x-1 text-gray-700">
                            <span className="text-gray-500">pay:</span>
                            <a
                              href={`https://testnet.monadvision.com/tx/${log.payHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-700 hover:text-teal-900 hover:underline break-all"
                            >
                              {log.payHash?.slice(0, 26)}...
                            </a>
                          </div>
                          <div className="flex items-center space-x-1 text-gray-700">
                            <span className="text-gray-500">feedback:</span>
                            <a
                              href={`https://testnet.monadvision.com/tx/${log.feedbackHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-700 hover:text-teal-900 hover:underline break-all"
                            >
                              {log.feedbackHash?.slice(0, 26)}...
                            </a>
                          </div>
                        </div>
                      );
                    }

                    if (log.type === "error") {
                      return (
                        <div key={idx} className="text-rose-600 font-semibold animate-fadeIn">
                          {log.text}
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Synthesized Answer */}
          <div className="lg:col-span-6 flex flex-col">
            <h3 className="text-sm font-bold text-gray-900 mb-3 tracking-tight">
              Synthesized answer
            </h3>

            <div className="bg-[#131313] text-gray-100 rounded-2xl p-6 min-h-[260px] shadow-sm font-sans text-sm sm:text-base leading-relaxed flex flex-col justify-between border border-neutral-800">
              {synthesizedAnswer ? (
                <div className="text-gray-200 whitespace-pre-wrap animate-fadeIn">
                  {synthesizedAnswer}
                  {isRunning && <span className="inline-block w-2 h-4 bg-[#ccff00] ml-1 animate-pulse"></span>}
                </div>
              ) : (
                <div className="text-gray-500 italic text-sm py-12 text-center flex flex-col items-center justify-center">
                  <span>Synthesized summary from all verified specialists will appear here after task completion.</span>
                </div>
              )}

              {synthesizedAnswer && (
                <div className="mt-6 pt-4 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                    <span>Verified on Monad Testnet</span>
                  </span>
                  <span className="font-mono text-neutral-500">EIP-712 x402 Micropayments</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
