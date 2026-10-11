"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Navbar } from "../../components/Navbar";
import { PageBackdrop, SiteFooter } from "../../components/PageChrome";
import { useActivityStore, TransactionActivity, TransactionType } from "../../lib/activity-store";
import { MONAD_CONTRACTS } from "../../lib/contracts";
import { ethers } from "ethers";
import { fetchOnchainActivity } from "../../lib/onchain-activity";

export default function ActivityPage() {
  const { activities, mergeActivities } = useActivityStore();
  const [activeType, setActiveType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scan, setScan] = useState<{ loading: boolean; window?: string; found?: number; error?: string }>({ loading: false });

  // Pull the marketplace's real contract events from Monad Testnet
  const scanChain = async () => {
    setScan({ loading: true });
    try {
      const { items, fromBlock, toBlock } = await fetchOnchainActivity(3000);
      mergeActivities(items);
      setScan({ loading: false, window: `${fromBlock.toLocaleString()}–${toBlock.toLocaleString()}`, found: items.length });
    } catch (e: any) {
      setScan({ loading: false, error: e.message });
    }
  };

  useEffect(() => {
    scanChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Only count USDC that actually moved (status "settled"), not merely recorded calls
  const settledCount = activities.filter((a) => a.type === "x402_payment" && a.status === "settled").length;
  const totalVolumeUSDC = (settledCount * 0.001).toFixed(3);
  const scores = activities.map((a) => a.metadata?.scoreGiven).filter((s): s is number => typeof s === "number");
  const avgScore = scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null;

  return (
    <div className="relative isolate min-h-screen flex flex-col justify-between font-sans bg-[#0e0e0f] text-white overflow-x-clip">
      <PageBackdrop />
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          {/* Top Header */}
          <div className="bg-[#121214] rounded-3xl border border-white/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] p-8 sm:p-10 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#ccff00]/10 blur-3xl rounded-full pointer-events-none -mr-20 -mt-20" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xs font-bold tracking-wider text-[#ccff00] uppercase bg-[#ccff00]/10 px-3 py-1 rounded-full border border-[#ccff00]/60">
                    ONCHAIN TRANSACTION AUDIT TRAIL
                  </span>
                  <span className="text-xs text-emerald-300 font-mono font-semibold flex items-center space-x-1 bg-emerald-400/10 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Monad Testnet 10143</span>
                  </span>
                </div>

                <h1 className="font-display uppercase text-white leading-[0.95] text-[clamp(1.9rem,4.6vw,3.4rem)]">
                  Autonomous Activity & Transaction Explorer
                </h1>
                <p className="text-sm text-white/60 mt-2 max-w-3xl leading-relaxed">
                  Every x402 micropayment settlement, onchain reputation rating, ERC-8004 agent registration, and soulbound certificate minted on Monad Testnet is deterministically logged with verified transaction hashes and explorer links.
                </p>
              </div>

              {/* Current Block Height Pill & Refresh Button */}
              <div className="flex items-center space-x-3 shrink-0">
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-right">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider block">
                    Current Block Height
                  </span>
                  <span className="font-mono font-black text-white text-base">
                    {currentBlock ? `#${currentBlock.toLocaleString()}` : "Syncing..."}
                  </span>
                </div>

                <button
                  onClick={fetchBlockHeight}
                  disabled={refreshing}
                  className="p-3 rounded-2xl bg-[#121214] border border-white/10 text-white/75 hover:bg-white/[0.06] hover:border-[#ccff00]/40 transition-all shadow-sm font-bold text-xs flex items-center justify-center"
                  title="Sync RPC Block Height"
                >
                  <span className={refreshing ? "animate-spin" : ""}>🔄</span>
                </button>
              </div>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#121214] border border-white/10 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-white/40 block mb-1">
                Total Transactions
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black text-white">{totalCount}</span>
                <span className="text-xs font-mono text-emerald-300 font-bold">Onchain</span>
              </div>
              <span className="text-[11px] text-white/50 mt-1 block">
                {scan.loading ? "Scanning recent blocks…" : scan.window ? `Blocks ${scan.window} + your session` : "Your session"}
              </span>
            </div>

            <div className="bg-[#121214] border border-white/10 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-white/40 block mb-1">
                x402 Paid Calls
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black text-white">{paymentCount}</span>
                <span className="text-xs font-mono text-white/50">recorded</span>
              </div>
              <span className="text-[11px] text-white/50 mt-1 block">
                {settledCount} settled in USDC · ${totalVolumeUSDC}
              </span>
            </div>

            <div className="bg-[#121214] border border-white/10 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-white/40 block mb-1">
                Reputation Feedbacks
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black text-white">{feedbackCount}</span>
                <span className="text-xs font-mono text-emerald-300 font-bold">Onchain</span>
              </div>
              <span className="text-[11px] text-white/50 mt-1 block">
                {avgScore !== null ? `Average score: ${avgScore}/100` : "No scores yet"}
              </span>
            </div>

            <div className="bg-[#121214] border border-white/10 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-white/40 block mb-1">
                Registrations & Credentials
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-black text-white">{registrationCount + credentialCount}</span>
                <span className="text-xs font-mono text-white/50">events</span>
              </div>
              <span className="text-[11px] text-white/50 mt-1 block">
                {registrationCount} agents · {credentialCount} soulbound
              </span>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="bg-[#121214] rounded-3xl border border-white/10 shadow-sm p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Type Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveType("all")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    activeType === "all"
                      ? "bg-white/10 text-white shadow-sm"
                      : "bg-white/[0.06] text-white/75 hover:bg-white/15"
                  }`}
                >
                  All ({totalCount})
                </button>

                <button
                  onClick={() => setActiveType("x402_payment")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeType === "x402_payment"
                      ? "bg-[#ccff00] text-black shadow-sm font-black"
                      : "bg-white/[0.06] text-white/75 hover:bg-white/15"
                  }`}
                >
                  <span>x402 Micropayments</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-white/10 rounded-full">{paymentCount}</span>
                </button>

                <button
                  onClick={() => setActiveType("reputation_feedback")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeType === "reputation_feedback"
                      ? "bg-blue-600 text-white shadow-sm font-black"
                      : "bg-white/[0.06] text-white/75 hover:bg-white/15"
                  }`}
                >
                  <span>Reputation Feedback</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-white/10 rounded-full">{feedbackCount}</span>
                </button>

                <button
                  onClick={() => setActiveType("agent_registration")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeType === "agent_registration"
                      ? "bg-white/10 text-white shadow-sm font-black"
                      : "bg-white/[0.06] text-white/75 hover:bg-white/15"
                  }`}
                >
                  <span>Agent Registrations</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-white/10 rounded-full">{registrationCount}</span>
                </button>

                <button
                  onClick={() => setActiveType("soulbound_credential")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    activeType === "soulbound_credential"
                      ? "bg-emerald-600 text-white shadow-sm font-black"
                      : "bg-white/[0.06] text-white/75 hover:bg-white/15"
                  }`}
                >
                  <span>Soulbound Credentials</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-white/10 rounded-full">{credentialCount}</span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by hash, agent, skill, address..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:border-[#ccff00]/60 font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#ccff00] text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-[#121214] rounded-3xl border border-white/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  Transaction Records ({filteredActivities.length})
                </h2>
                <p className="text-xs text-white/50">
                  {scan.error
                    ? `Chain scan failed: ${scan.error}`
                    : "Decoded from IdentityRegistry, ReputationRegistry and AcademyCredential events, plus transactions sent from this browser."}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button onClick={scanChain} disabled={scan.loading} className="btn-ghost btn-sm disabled:opacity-50">
                  <span>{scan.loading ? "Scanning…" : "Rescan chain"}</span>
                </button>
              </div>
            </div>

            {filteredActivities.length === 0 ? (
              <div className="py-20 text-center text-white/40 font-mono text-xs">
                {scan.loading
                  ? "Reading the last 3,000 blocks of contract events from Monad Testnet…"
                  : activities.length === 0
                  ? "No marketplace events in the scanned window yet — run a task from the Command Deck to create some."
                  : "No transactions match the selected filter or search term."}
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {filteredActivities.map((act) => {
                  const isExpanded = expandedTxId === act.id;
                  const isCopied = copiedId === act.id;

                  const typeBadge =
                    act.type === "x402_payment" ? (
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/60">
                        x402 Micropayment
                      </span>
                    ) : act.type === "reputation_feedback" ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-blue-400/10 text-blue-300 border border-blue-400/30">
                        Reputation Rating
                      </span>
                    ) : act.type === "agent_registration" ? (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-white/[0.06] text-white/85 border border-white/10">
                        Agent Registration
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/30">
                        Soulbound Credential
                      </span>
                    );

                  return (
                    <div key={act.id} className="p-6 hover:bg-white/[0.03] transition-colors">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Left Info */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center space-x-2.5">
                            {typeBadge}
                            <span className="text-xs font-mono text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>Confirmed</span>
                            </span>
                            {act.blockNumber && (
                              <span className="text-xs font-mono text-white/50">
                                Block #{act.blockNumber}
                              </span>
                            )}
                            <span className="text-xs text-white/40 font-mono">
                              {new Date(act.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-white leading-snug">
                            {act.title}
                          </h3>

                          <p className="text-xs text-white/60 leading-relaxed max-w-4xl">
                            {act.description}
                          </p>

                          {/* Address & Hash Routing Row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono pt-1 text-white/50">
                            <div className="flex items-center space-x-1">
                              <span className="text-white/40">Tx:</span>
                              <span className="font-semibold text-white/85">
                                {act.txHash.slice(0, 10)}...{act.txHash.slice(-8)}
                              </span>
                              <button
                                onClick={() => handleCopy(act.txHash, act.id)}
                                className="text-white/40 hover:text-[#ccff00] ml-1"
                                title="Copy Full Hash"
                              >
                                {isCopied ? "✓" : "📋"}
                              </button>
                            </div>

                            <span>•</span>

                            <div className="flex items-center space-x-1">
                              <span className="text-white/40">From:</span>
                              <span title={act.from} className="text-white/75">
                                {act.from.slice(0, 6)}...{act.from.slice(-4)}
                              </span>
                            </div>

                            <span>→</span>

                            <div className="flex items-center space-x-1">
                              <span className="text-white/40">To:</span>
                              <span title={act.to} className="text-white/75 font-semibold">
                                {act.contractName || `${act.to.slice(0, 6)}...${act.to.slice(-4)}`}
                              </span>
                            </div>

                            {act.amount && (
                              <>
                                <span>•</span>
                                <div>
                                  <span className="text-white/40">Value: </span>
                                  <span className="font-bold text-white">{act.amount}</span>
                                </div>
                              </>
                            )}

                            {act.gasFee && (
                              <>
                                <span>•</span>
                                <div className="text-white/40">
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
                              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/15 text-white/85 font-bold text-xs flex items-center space-x-1 transition-all"
                            >
                              <span>MonadVision</span>
                              <span>↗</span>
                            </a>
                            <a
                              href={act.monadscanUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 text-white/60 font-bold text-xs flex items-center space-x-1 transition-all"
                            >
                              <span>Monadscan</span>
                              <span>↗</span>
                            </a>
                          </div>

                          <button
                            onClick={() => setExpandedTxId(isExpanded ? null : act.id)}
                            className="text-xs text-white/50 hover:text-[#ccff00] font-semibold flex items-center space-x-1 mt-1"
                          >
                            <span>{isExpanded ? "Hide Payload ▲" : "Inspect Payload ▼"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Expandable Details Drawer */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-white/10 bg-white/[0.04] rounded-2xl p-4 animate-fadeIn font-mono text-xs text-white/85 space-y-3">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <span className="font-bold uppercase text-[10px] tracking-wider text-white/50">
                              Complete Transaction Payload & Verification State
                            </span>
                            <span className="text-[10px] text-white/40">Chain ID: 10143 (Monad Testnet)</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                            <div>
                              <span className="text-white/40 block text-[10px]">Full Transaction Hash:</span>
                              <span className="break-all font-bold text-white">{act.txHash}</span>
                            </div>
                            <div>
                              <span className="text-white/40 block text-[10px]">Target Contract Address:</span>
                              <span className="break-all font-bold text-white">{act.to}</span>
                            </div>
                            <div>
                              <span className="text-white/40 block text-[10px]">Caller / Origin Wallet:</span>
                              <span className="break-all text-white/75">{act.from}</span>
                            </div>
                            <div>
                              <span className="text-white/40 block text-[10px]">Block Timestamp:</span>
                              <span className="text-white/75">{act.timestamp}</span>
                            </div>
                          </div>

                          {act.metadata && (
                            <div className="pt-2 border-t border-white/10">
                              <span className="text-white/40 block text-[10px] mb-1">Decoded Parameters / Metadata:</span>
                              <pre className="bg-[#121214] p-3 rounded-xl border border-white/10 text-[11px] overflow-x-auto text-white/85">
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

      <SiteFooter note="All transactions are settled on Monad Testnet (Chain ID 10143). Not an official Monad Labs product." />
    </div>
  );
}
