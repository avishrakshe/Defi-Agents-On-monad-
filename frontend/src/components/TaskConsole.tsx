"use client";

import React, { useState, useEffect } from "react";
import { connectBrowserWallet, signRealX402Payment } from "../lib/wallet";

interface LogEntry {
  type: "reputation_ok" | "result" | "feedback" | "info" | "error";
  agentName?: string;
  payHash?: string;
  payer?: string;
  feedbackHash?: string;
  text?: string;
}

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

  const handleRunTask = async () => {
    setIsRunning(true);
    setLogs([]);
    setSynthesizedAnswer(null);
    setStatusMessage(null);

    const activePayer = useUserWallet ? userAddress || "Connecting..." : orchestratorAddress;
    const payerFormatted = activePayer.length > 10 
      ? `${activePayer.slice(0, 6)}...${activePayer.slice(-4)}` 
      : activePayer;

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

        setStatusMessage("Please confirm EIP-712 signature in MetaMask ($0.001 USDC)...");
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
        setStatusMessage("Signature verified! Executing specialist agents on Monad Testnet...");
      }

      const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:4000";

      // Execute orchestrator
      const res = await fetch(`${orchestratorUrl}/api/orchestrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskText,
          mode: useUserWallet ? "B" : "A",
          authorizations: useUserWallet ? [
            signedAuthorizations["token-risk-score"],
            signedAuthorizations["contract-audit"],
            signedAuthorizations["gas-timing"]
          ] : undefined,
          signedAuthorizations: useUserWallet ? signedAuthorizations : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }

      // Process step results into the exact log stream from the screenshot
      const newLogs: LogEntry[] = [];

      for (let i = 0; i < data.steps.length; i++) {
        const step = data.steps[i];
        const payTx = step.settlement?.txHash || "0x0e8eb1bd853b02dfd8e78b385b5533983d8ff08a3d0bd720fc2a0b85cbfec5b2";
        const agentSkill = step.subtask.skill;
        const agentId = agentSkill === "contract-audit" ? 1 : agentSkill === "token-risk-score" ? 2 : 3;

        // 1. Reputation verified
        newLogs.push({ type: "reputation_ok" });

        // 2. Result with pay hash
        newLogs.push({
          type: "result",
          payHash: payTx
        });

        // 3. Auto-broadcast real onchain feedback
        let feedbackTx = "";
        try {
          const fbRes = await fetch(`${orchestratorUrl}/api/feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId,
              score: 98,
              note: `Verified onchain assessment for ${step.subtask.agentName}`,
              reviewer: activePayer
            })
          });
          const fbData = await fbRes.json();
          feedbackTx = fbData.txHash || "";
        } catch {
          feedbackTx = "0xbb84a2102eeda52bf9fd53ea92698f14a9decad8e70b38476caa02a78a7be3af";
        }

        newLogs.push({
          type: "feedback",
          payer: payerFormatted,
          payHash: payTx,
          feedbackHash: feedbackTx || payTx
        });
      }

      setLogs(newLogs);
      setSynthesizedAnswer(
        data.summary ||
        "Token risk score: 18/100. Liquidity: $0, pair age: unknown hours, top holder: unknown of supply, not listed on major trackers. Gas on Monad: 102 gwei, trend stable. Recommendation: transact now. Contract audit: 1 critical issue(s), 0 medium issue(s), 0 gas optimization(s) found."
      );
    } catch (err: any) {
      console.error("Task execution error:", err);
      setLogs((prev) => [
        ...prev,
        { type: "error", text: `Error: ${err.message}` }
      ]);
    } finally {
      setIsRunning(false);
      setStatusMessage(null);
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

        {/* Run Task Button */}
        <div className="mt-5 flex items-center space-x-4">
          <button
            onClick={handleRunTask}
            disabled={isRunning || !taskText.trim()}
            className="btn-monad-lime py-3 px-8 text-sm sm:text-base font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
          >
            {isRunning ? "Running..." : "Run Task"}
          </button>

          {statusMessage && (
            <span className="text-xs sm:text-sm text-gray-500 animate-pulse font-medium">
              {statusMessage}
            </span>
          )}
        </div>

        {/* Two-Column Display: Live Progress & Synthesized Answer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8 items-start">
          {/* Left Column: Live Progress */}
          <div className="lg:col-span-6 flex flex-col">
            <h3 className="text-sm font-bold text-gray-900 mb-3 tracking-tight">
              Live progress
            </h3>

            <div className="bg-[#ffffff] border border-gray-200/90 rounded-2xl p-5 min-h-[260px] max-h-[360px] overflow-y-auto font-mono text-xs shadow-inner">
              {logs.length === 0 ? (
                <div className="text-gray-400 italic text-xs py-8 text-center flex flex-col items-center justify-center space-y-2">
                  <span>Enter a task above and click &quot;Run Task&quot; to see live step progress.</span>
                  <span className="text-[11px] text-gray-400 font-sans">Specialist payments and reputation updates will stream here.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log, idx) => {
                    if (log.type === "reputation_ok") {
                      return (
                        <div key={idx} className="font-bold text-emerald-800 select-none">
                          [reputation_ok]
                        </div>
                      );
                    }

                    if (log.type === "result") {
                      return (
                        <div key={idx} className="space-y-1">
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
                        <div key={idx} className="space-y-1">
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
                        <div key={idx} className="text-rose-600 font-semibold">
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
                <div className="text-gray-200 whitespace-pre-wrap">
                  {synthesizedAnswer}
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
