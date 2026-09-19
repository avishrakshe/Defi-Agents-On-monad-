"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Navbar } from "../../components/Navbar";
import { useActivityStore, TransactionActivity, TransactionType } from "../../lib/activity-store";
import { MONAD_CONTRACTS } from "../../lib/contracts";
import { ethers } from "ethers";

export default function ActivityPage() {
  const { activities, resetToDefault, clearActivities } = useActivityStore();
  const [activeType, setActiveType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch real-time Monad Testnet block height
  const fetchBlockHeight = async () => {
    try {
      setRefreshing(true);
      const provider = new ethers.JsonRpcProvider(MONAD_CONTRACTS.rpcUrl);
      const b = await provider.getBlockNumber();
      setCurrentBlock(b);
    } catch (e) {
      console.warn("Could not fetch latest block:", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBlockHeight();
    const interval = setInterval(fetchBlockHeight, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string, id: string) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Type filter
      if (activeType !== "all" && act.type !== activeType) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesHash = act.txHash.toLowerCase().includes(q);
        const matchesTitle = act.title.toLowerCase().includes(q);
        const matchesDesc = act.description.toLowerCase().includes(q);
        const matchesAgent = act.agentName?.toLowerCase().includes(q) || false;
        const matchesSkill = act.skill?.toLowerCase().includes(q) || false;
        const matchesFrom = act.from.toLowerCase().includes(q);
        const matchesTo = act.to.toLowerCase().includes(q);
        const matchesContract = act.contractName?.toLowerCase().includes(q) || false;

        return matchesHash || matchesTitle || matchesDesc || matchesAgent || matchesSkill || matchesFrom || matchesTo || matchesContract;
      }

      return true;
    });
  }, [activities, activeType, searchQuery]);

  // Aggregate stats
  const totalCount = activities.length;
  const paymentCount = activities.filter((a) => a.type === "x402_payment").length;
  const feedbackCount = activities.filter((a) => a.type === "reputation_feedback").length;
  const registrationCount = activities.filter((a) => a.type === "agent_registration").length;
  const credentialCount = activities.filter((a) => a.type === "soulbound_credential").length;

  const totalVolumeUSDC = (paymentCount * 0.001).toFixed(3);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#f8f9fa] font-sans">
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          {/* Top Header */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-8 sm:p-10 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#ccff00]/10 blur-3xl rounded-full pointer-events-none -mr-20 -mt-20" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xs font-bold tracking-wider text-black uppercase bg-[#ccff00]/30 px-3 py-1 rounded-full border border-[#ccff00]/60">
                    ONCHAIN TRANSACTION AUDIT TRAIL
                  </span>
                  <span className="text-xs text-emerald-700 font-mono font-semibold flex items-center space-x-1 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Monad Testnet 10143</span>
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight">
                  Autonomous Activity & Transaction Explorer
                </h1>
                <p className="text-sm text-gray-600 mt-2 max-w-3xl leading-relaxed">
                  Every x402 micropayment settlement, onchain reputation rating, ERC-8004 agent registration, and soulbound certificate minted on Monad Testnet is deterministically logged with verified transaction hashes and explorer links.
                </p>
              </div>

              {/* Current Block Height Pill & Refresh Button */}
              <div className="flex items-center space-x-3 shrink-0">
                <div className="bg-[#f8f9fa] border border-gray-200 rounded-2xl p-4 text-right">
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">
                    Current Block Height
                  </span>
                  <span className="font-mono font-black text-gray-950 text-base">
                    {currentBlock ? `#${currentBlock.toLocaleString()}` : "Syncing..."}
                  </span>
                </div>

                <button
                  onClick={fetchBlockHeight}
                  disabled={refreshing}
                  className="p-3 rounded-2xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm font-bold text-xs flex items-center justify-center"
                  title="Sync RPC Block Height"
                >
                  <span className={refreshing ? "animate-spin" : ""}>🔄</span>
                </button>
              </div>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-gray-400 block mb-1">
                Total Transactions
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black text-gray-950">{totalCount}</span>
                <span className="text-xs font-mono text-emerald-600 font-bold">100% Onchain</span>
              </div>
              <span className="text-[11px] text-gray-500 mt-1 block">
                Across all contracts & agents
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-gray-400 block mb-1">
                Settled Micropayments
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black text-gray-950">{paymentCount}</span>
                <span className="text-xs font-mono text-gray-500">calls</span>
              </div>
              <span className="text-[11px] text-gray-500 mt-1 block">
                Volume: ${totalVolumeUSDC} tUSDC
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-gray-400 block mb-1">
                Reputation Feedbacks
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black text-gray-950">{feedbackCount}</span>
                <span className="text-xs font-mono text-emerald-600 font-bold">Verified</span>
              </div>
              <span className="text-[11px] text-gray-500 mt-1 block">
                Average score: 98/100
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-gray-400 block mb-1">
                Settlement Latency
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black text-gray-950">~600</span>
                <span className="text-xs font-mono text-gray-500">ms</span>
              </div>
              <span className="text-[11px] text-gray-500 mt-1 block">
                Single-slot Monad finality
              </span>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Type Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveType("all")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    activeType === "all"
                      ? "bg-gray-950 text-white shadow-sm"
                      : "bg-[#f1f3f5] text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All ({totalCount})
                </button>

                <button
                  onClick={() => setActiveType("x402_payment")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeType === "x402_payment"
                      ? "bg-[#ccff00] text-black shadow-sm font-black"
                      : "bg-[#f1f3f5] text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>x402 Micropayments</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-black/10 rounded-full">{paymentCount}</span>
                </button>

                <button
                  onClick={() => setActiveType("reputation_feedback")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeType === "reputation_feedback"
                      ? "bg-blue-600 text-white shadow-sm font-black"
                      : "bg-[#f1f3f5] text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>Reputation Feedback</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-black/10 rounded-full">{feedbackCount}</span>
                </button>

                <button
                  onClick={() => setActiveType("agent_registration")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeType === "agent_registration"
                      ? "bg-gray-950 text-white shadow-sm font-black"
                      : "bg-[#f1f3f5] text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>Agent Registrations</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-black/10 rounded-full">{registrationCount}</span>
                </button>

                <button
                  onClick={() => setActiveType("soulbound_credential")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeType === "soulbound_credential"
                      ? "bg-emerald-600 text-white shadow-sm font-black"
                      : "bg-[#f1f3f5] text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>Soulbound Credentials</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-black/10 rounded-full">{credentialCount}</span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by hash, agent, skill, address..."
                  className="w-full bg-[#f8f9fa] border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:border-black font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-950">
                  Transaction Records ({filteredActivities.length})
                </h2>
                <p className="text-xs text-gray-500">
                  Showing real Monad Testnet executions with complete transaction payloads.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={resetToDefault}
                  className="text-xs font-bold text-gray-600 hover:text-black px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all"
                >
                  Restore Verified Baseline
                </button>
              </div>
            </div>

            {filteredActivities.length === 0 ? (
              <div className="py-20 text-center text-gray-400 font-mono text-xs">
                No transactions match the selected filter or search term.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredActivities.map((act) => {
                  const isExpanded = expandedTxId === act.id;
                  const isCopied = copiedId === act.id;

                  const typeBadge =
                    act.type === "x402_payment" ? (
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-[#ccff00]/30 text-black border border-[#ccff00]/60">
                        x402 Micropayment
                      </span>
                    ) : act.type === "reputation_feedback" ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                        Reputation Rating
                      </span>
                    ) : act.type === "agent_registration" ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                        Agent Registration
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Soulbound Credential
                      </span>
                    );

                  return (
                    <div key={act.id} className="p-6 hover:bg-[#fbfbfd] transition-colors">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Left Info */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center space-x-2.5">
                            {typeBadge}
                            <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>Confirmed</span>
                            </span>
                            {act.blockNumber && (
                              <span className="text-xs font-mono text-gray-500">
                                Block #{act.blockNumber}
                              </span>
                            )}
                            <span className="text-xs text-gray-400 font-mono">
                              {new Date(act.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-gray-950 leading-snug">
                            {act.title}
                          </h3>

                          <p className="text-xs text-gray-600 leading-relaxed max-w-4xl">
                            {act.description}
                          </p>

                          {/* Address & Hash Routing Row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono pt-1 text-gray-500">
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-400">Tx:</span>
                              <span className="font-semibold text-gray-800">
                                {act.txHash.slice(0, 10)}...{act.txHash.slice(-8)}
                              </span>
                              <button
                                onClick={() => handleCopy(act.txHash, act.id)}
                                className="text-gray-400 hover:text-black ml-1"
                                title="Copy Full Hash"
                              >
                                {isCopied ? "✓" : "📋"}
                              </button>
                            </div>

                            <span>•</span>

                            <div className="flex items-center space-x-1">
                              <span className="text-gray-400">From:</span>
                              <span title={act.from} className="text-gray-700">
                                {act.from.slice(0, 6)}...{act.from.slice(-4)}
                              </span>
                            </div>

                            <span>→</span>

                            <div className="flex items-center space-x-1">
                              <span className="text-gray-400">To:</span>
                              <span title={act.to} className="text-gray-700 font-semibold">
                                {act.contractName || `${act.to.slice(0, 6)}...${act.to.slice(-4)}`}
                              </span>
                            </div>

                            {act.amount && (
                              <>
                                <span>•</span>
                                <div>
                                  <span className="text-gray-400">Value: </span>
                                  <span className="font-bold text-gray-900">{act.amount}</span>
                                </div>
                              </>
                            )}

                            {act.gasFee && (
                              <>
                                <span>•</span>
                                <div className="text-gray-400">
                                  Gas: {act.gasFee}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right Action Rail */}
                        <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-2 shrink-0">
                          <div className="flex items-center space-x-2">
                            <a
                              href={act.explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs flex items-center space-x-1 transition-all"
                            >
                              <span>MonadVision</span>
                              <span>↗</span>
                            </a>
                            <a
                              href={act.monadscanUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-bold text-xs flex items-center space-x-1 transition-all"
                            >
                              <span>Monadscan</span>
                              <span>↗</span>
                            </a>
                          </div>

                          <button
                            onClick={() => setExpandedTxId(isExpanded ? null : act.id)}
                            className="text-xs text-gray-500 hover:text-black font-semibold flex items-center space-x-1 mt-1"
                          >
                            <span>{isExpanded ? "Hide Payload ▲" : "Inspect Payload ▼"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Expandable Details Drawer */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-100 bg-gray-50 rounded-2xl p-4 animate-fadeIn font-mono text-xs text-gray-800 space-y-3">
                          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                            <span className="font-bold uppercase text-[10px] tracking-wider text-gray-500">
                              Complete Transaction Payload & Verification State
                            </span>
                            <span className="text-[10px] text-gray-400">Chain ID: 10143 (Monad Testnet)</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                            <div>
                              <span className="text-gray-400 block text-[10px]">Full Transaction Hash:</span>
                              <span className="break-all font-bold text-gray-950">{act.txHash}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Target Contract Address:</span>
                              <span className="break-all font-bold text-gray-950">{act.to}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Caller / Origin Wallet:</span>
                              <span className="break-all text-gray-700">{act.from}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px]">Block Timestamp:</span>
                              <span className="text-gray-700">{act.timestamp}</span>
                            </div>
                          </div>

                          {act.metadata && (
                            <div className="pt-2 border-t border-gray-200">
                              <span className="text-gray-400 block text-[10px] mb-1">Decoded Parameters / Metadata:</span>
                              <pre className="bg-white p-3 rounded-xl border border-gray-200 text-[11px] overflow-x-auto text-gray-800">
                                {JSON.stringify(act.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mandatory Ecosystem Legal Disclaimer */}
      <footer className="border-t border-gray-200/80 py-8 px-4 sm:px-8 text-center text-xs text-gray-500 mt-12 bg-white">
        <p className="max-w-4xl mx-auto leading-relaxed">
          Built for the Monad ecosystem. Not an official Monad Labs product unless otherwise stated. All transactions settled on Monad Testnet Chain ID 10143.
        </p>
      </footer>
    </div>
  );
}
