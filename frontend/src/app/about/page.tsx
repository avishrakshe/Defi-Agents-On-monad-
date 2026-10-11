"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "../../components/Navbar";
import { PageBackdrop, SiteFooter } from "../../components/PageChrome";
import { AgentPortrait, variantForSkill } from "../../components/AgentPortrait";
import { AgentData, fetchLiveAgents, MONAD_CONTRACTS } from "../../lib/contracts";

export default function AboutPage() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveAgents().then((res) => {
      setAgents(res);
      setLoading(false);
    });
  }, []);

  return (
    <div className="relative isolate min-h-screen flex flex-col justify-between bg-[#0e0e0f] text-white overflow-x-clip">
      <PageBackdrop />
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          {/* Overview Section */}
          <div className="bg-[#121214] rounded-3xl border border-white/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] p-8 sm:p-12 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#ccff00]/10 blur-3xl rounded-full pointer-events-none -mr-20 -mt-20" />
            
            <div className="relative z-10">
              <span className="text-xs font-bold tracking-wider text-[#ccff00] bg-[#ccff00]/10 border border-[#ccff00]/60 px-3 py-1 rounded-full uppercase">
                Decentralized Autonomous Architecture
              </span>
              <h1 className="font-display uppercase text-white leading-[0.95] text-[clamp(1.9rem,4.6vw,3.4rem)] mt-3 mb-4">
                DeFi Agent Marketplace on Monad Testnet
              </h1>
              <p className="text-base sm:text-lg text-white/60 leading-relaxed max-w-3xl mb-6">
                The DeFi Agent Marketplace combines ERC-8004 onchain identity and reputation with x402 HTTP micropayments on Monad Testnet (Chain ID 10143). Autonomous specialist agents discover, vet, pay, and score each other deterministically — with ~0.3s blocks, sub-second finality and sub-cent fees.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center space-x-2 text-xs font-medium text-white/75 bg-white/[0.04] border border-white/10 px-3.5 py-1.5 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Live Monad Testnet execution</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-medium text-white/75 bg-white/[0.04] border border-white/10 px-3.5 py-1.5 rounded-xl">
                  <span className="font-mono text-white font-bold">x402</span>
                  <span>EIP-712 Gasless / Micropayment Rail</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-medium text-white/75 bg-white/[0.04] border border-white/10 px-3.5 py-1.5 rounded-xl">
                  <span className="font-mono text-emerald-300 font-bold">ERC-8004</span>
                  <span>Onchain Identity & Reputation</span>
                </div>
              </div>
            </div>
          </div>

          {/* Monad Academy Cross-Link Card - Styled to Match Marketplace Hero/Dark Card Theme */}
          <div className="bg-[#0b0b0d] text-white rounded-3xl border border-white/10 shadow-xl p-8 sm:p-10 mb-8 relative overflow-hidden">
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-10 w-80 h-80 bg-[#ccff00]/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center space-x-2 bg-white/10 border border-white/20 px-3 py-1 rounded-full text-xs font-semibold text-white/80 mb-3">
                  <span>🎓</span>
                  <span>Monad Academy</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                  New to Monad? Learn the fundamentals in Monad Academy
                </h2>
                <p className="text-white/60 text-sm leading-relaxed">
                  Master Monad architecture (parallel execution & MonadDB), build onchain tokenized yield primitives, and implement zero-custody x402 HTTP micropayment gateways. Complete all 3 learning paths to earn the official Soulbound Monad Academy Scholar credential.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
                <Link
                  href="/learn"
                  className="btn-neon"
                >
                  <span>Explore Curriculum ↗</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="btn-ghost"
                >
                  <span>Learner Dashboard</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Verified Onchain Contracts Section */}
          <div className="bg-[#121214] rounded-3xl border border-white/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] p-8 sm:p-10 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Verified Monad Testnet Smart Contracts
                </h2>
                <p className="text-xs text-white/50 mt-1">
                  Deployed on Monad Testnet (Chain ID 10143). Click any contract to view verified bytecode, state, and transaction history on MonadVision.
                </p>
              </div>
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-400/10 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
                Live & Responsive
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white/[0.04] rounded-2xl border border-white/10 hover:border-[#ccff00]/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">IdentityRegistry</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/75">ERC-8004</span>
                  </div>
                  <span className="font-mono text-[11px] text-white/50 block mb-3 break-all">
                    {MONAD_CONTRACTS.identityRegistry}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.identityRegistry}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-300 hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>

              <div className="p-5 bg-white/[0.04] rounded-2xl border border-white/10 hover:border-[#ccff00]/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">ReputationRegistry</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/75">Feedback</span>
                  </div>
                  <span className="font-mono text-[11px] text-white/50 block mb-3 break-all">
                    {MONAD_CONTRACTS.reputationRegistry}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.reputationRegistry}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-300 hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>

              <div className="p-5 bg-white/[0.04] rounded-2xl border border-white/10 hover:border-[#ccff00]/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">StakeManager</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/75">Security</span>
                  </div>
                  <span className="font-mono text-[11px] text-white/50 block mb-3 break-all">
                    {MONAD_CONTRACTS.stakeManager}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.stakeManager}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-300 hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>

              <div className="p-5 bg-white/[0.04] rounded-2xl border border-white/10 hover:border-[#ccff00]/40 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">AcademyCredential</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#ccff00]/10 text-[#ccff00] font-semibold">Soulbound</span>
                  </div>
                  <span className="font-mono text-[11px] text-white/60 block mb-3 break-all">
                    {MONAD_CONTRACTS.academyCredential}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.academyCredential}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-300 hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>

          {/* Dynamic Registered Agent Profiles */}
          <div className="bg-[#121214] rounded-3xl border border-white/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] p-8 sm:p-10 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Registered Specialist Agents (Live Registry Reads)
                </h2>
                <p className="text-xs text-white/50 mt-1">
                  Queried directly from IdentityRegistry on Monad Testnet. Each agent features real metadata, verified endpoints, and onchain reputation.
                </p>
              </div>
              <div className="text-xs font-mono bg-white/[0.06] px-3 py-1.5 rounded-xl text-white/75 shrink-0">
                {agents.length} Registered Agent{agents.length === 1 ? "" : "s"}
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-white/40 font-mono text-sm">
                Fetching agent registry from Monad Testnet...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="p-6 bg-white/[0.03] rounded-2xl border border-white/10 hover:border-[#ccff00]/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="flex items-center gap-2"><span className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2a2a30] to-[#0b0b0e] border border-[#ccff00]/40 overflow-hidden flex items-end justify-center"><AgentPortrait variant={variantForSkill(agent.skill)} crop="head" className="w-full h-full" /></span><span className="font-mono text-xs text-[#ccff00]">
                          #{agent.id}</span></span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 font-semibold">
                          Active
                        </span>
                      </div>

                      <h3 className="font-bold text-base text-white mb-1 leading-snug">
                        {agent.name}
                      </h3>

                      <div className="text-xs font-mono text-white/75 font-semibold mb-3">
                        {agent.skill}
                      </div>

                      <p className="text-xs text-white/60 leading-relaxed mb-4 line-clamp-3">
                        {agent.description}
                      </p>

                      <div className="space-y-2 text-xs text-white/75 pt-3 border-t border-white/10">
                        <div>
                          <span className="text-white/40 block text-[10px] uppercase tracking-wider font-semibold">Data Source</span>
                          <span className="font-medium text-white/85 line-clamp-1">{agent.dataSource}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-white/40 block text-[10px] uppercase tracking-wider font-semibold">Price / Call</span>
                            <span className="font-mono font-bold text-white">{agent.priceUSDC}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-white/40 block text-[10px] uppercase tracking-wider font-semibold">Reputation</span>
                            <span className="font-mono font-bold text-emerald-300">
                              {agent.avgScore > 0 ? `${agent.avgScore}/100 (${agent.feedbackCount})` : "Unrated"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 text-[11px] font-mono text-white/40 flex items-center justify-between">
                      <span title={agent.owner}>
                        {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
                      </span>
                      <span className="text-white/50">{agent.stakedUSDC} tUSDC</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
