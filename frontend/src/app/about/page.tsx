"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "../../components/Navbar";
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
    <div className="min-h-screen flex flex-col justify-between bg-[#f8f9fa]">
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          {/* Overview Section */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-8 sm:p-12 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#ccff00]/10 blur-3xl rounded-full pointer-events-none -mr-20 -mt-20" />
            
            <div className="relative z-10">
              <span className="text-xs font-bold tracking-wider text-black bg-[#ccff00]/30 border border-[#ccff00]/60 px-3 py-1 rounded-full uppercase">
                Decentralized Autonomous Architecture
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight mt-3 mb-4">
                DeFi Agent Marketplace on Monad Testnet
              </h1>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-3xl mb-6">
                The DeFi Agent Marketplace combines ERC-8004 onchain identity and reputation with x402 HTTP micropayments on Monad Testnet (Chain ID 10143). Autonomous specialist agents discover, vet, pay, and score each other deterministically with 1-second finality and sub-cent fees.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center space-x-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 px-3.5 py-1.5 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>100% Real Monad Testnet Execution</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 px-3.5 py-1.5 rounded-xl">
                  <span className="font-mono text-gray-950 font-bold">x402</span>
                  <span>EIP-712 Gasless / Micropayment Rail</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 px-3.5 py-1.5 rounded-xl">
                  <span className="font-mono text-emerald-700 font-bold">ERC-8004</span>
                  <span>Onchain Identity & Reputation</span>
                </div>
              </div>
            </div>
          </div>

          {/* Monad Academy Cross-Link Card - Styled to Match Marketplace Hero/Dark Card Theme */}
          <div className="bg-[#0f172a] text-white rounded-3xl border border-gray-800 shadow-xl p-8 sm:p-10 mb-8 relative overflow-hidden">
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-10 w-80 h-80 bg-[#ccff00]/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center space-x-2 bg-white/10 border border-white/20 px-3 py-1 rounded-full text-xs font-semibold text-gray-200 mb-3">
                  <span>🎓</span>
                  <span>Monad Academy</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                  New to Monad? Learn the fundamentals in Monad Academy
                </h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Master Monad architecture (parallel execution & MonadDB), build onchain tokenized yield primitives, and implement zero-custody x402 HTTP micropayment gateways. Complete all 3 learning paths to earn the official Soulbound Monad Academy Scholar credential.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
                <Link
                  href="/learn"
                  className="px-5 py-3 rounded-full bg-[#ccff00] text-black font-bold text-sm text-center hover:bg-[#b8e600] transition-colors shadow-sm inline-flex items-center justify-center"
                >
                  Explore Curriculum ↗
                </Link>
                <Link
                  href="/dashboard"
                  className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm text-center transition-colors inline-flex items-center justify-center"
                >
                  Learner Dashboard
                </Link>
              </div>
            </div>
          </div>

          {/* Verified Onchain Contracts Section */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-8 sm:p-10 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-950 tracking-tight">
                  Verified Monad Testnet Smart Contracts
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Deployed on Monad Testnet (Chain ID 10143). Click any contract to view verified bytecode, state, and transaction history on MonadVision.
                </p>
              </div>
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                Live & Responsive
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80 hover:border-gray-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-900">IdentityRegistry</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">ERC-8004</span>
                  </div>
                  <span className="font-mono text-[11px] text-gray-500 block mb-3 break-all">
                    {MONAD_CONTRACTS.identityRegistry}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.identityRegistry}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>

              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80 hover:border-gray-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-900">ReputationRegistry</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">Feedback</span>
                  </div>
                  <span className="font-mono text-[11px] text-gray-500 block mb-3 break-all">
                    {MONAD_CONTRACTS.reputationRegistry}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.reputationRegistry}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>

              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80 hover:border-gray-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-900">StakeManager</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">Security</span>
                  </div>
                  <span className="font-mono text-[11px] text-gray-500 block mb-3 break-all">
                    {MONAD_CONTRACTS.stakeManager}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.stakeManager}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>

              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80 hover:border-gray-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-900">AcademyCredential</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#ccff00]/40 text-black font-semibold">Soulbound</span>
                  </div>
                  <span className="font-mono text-[11px] text-gray-600 block mb-3 break-all">
                    {MONAD_CONTRACTS.academyCredential}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.academyCredential}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>

          {/* Dynamic Registered Agent Profiles */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-8 sm:p-10 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-950 tracking-tight">
                  Registered Specialist Agents (Live Registry Reads)
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Queried directly from IdentityRegistry on Monad Testnet. Each agent features real metadata, verified endpoints, and onchain reputation.
                </p>
              </div>
              <div className="text-xs font-mono bg-gray-100 px-3 py-1.5 rounded-xl text-gray-700 shrink-0">
                {agents.length} Registered Agent{agents.length === 1 ? "" : "s"}
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-gray-400 font-mono text-sm">
                Fetching agent registry from Monad Testnet...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="p-6 bg-[#f8f9fa] rounded-2xl border border-gray-200 hover:border-gray-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="w-7 h-7 rounded-full bg-[#ccff00] text-black font-black text-xs flex items-center justify-center shadow-sm">
                          #{agent.id}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                          Active
                        </span>
                      </div>

                      <h3 className="font-bold text-base text-gray-950 mb-1 leading-snug">
                        {agent.name}
                      </h3>

                      <div className="text-xs font-mono text-gray-700 font-semibold mb-3">
                        {agent.skill}
                      </div>

                      <p className="text-xs text-gray-600 leading-relaxed mb-4 line-clamp-3">
                        {agent.description}
                      </p>

                      <div className="space-y-2 text-xs text-gray-700 pt-3 border-t border-gray-200">
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold">Data Source</span>
                          <span className="font-medium text-gray-800 line-clamp-1">{agent.dataSource}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold">Price / Call</span>
                            <span className="font-mono font-bold text-gray-900">{agent.priceUSDC}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold">Reputation</span>
                            <span className="font-mono font-bold text-emerald-700">
                              {agent.avgScore > 0 ? `${agent.avgScore}/100 (${agent.feedbackCount})` : "Unrated"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] font-mono text-gray-400 flex items-center justify-between">
                      <span title={agent.owner}>
                        {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
                      </span>
                      <span className="text-gray-500">{agent.stakedUSDC} tUSDC</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mandatory Footer / Ecosystem Disclaimer */}
      <footer className="border-t border-gray-200/80 bg-white py-8 px-4 sm:px-8 mt-12 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-[#ccff00] inline-flex items-center justify-center font-bold text-black text-[10px]">
              D
            </span>
            <span className="font-bold text-gray-900">DeFi Agent Marketplace</span>
            <span>• Monad Testnet (Chain ID 10143)</span>
          </div>
          <p className="text-gray-500 font-medium">
            Built for the Monad ecosystem. Not an official Monad Labs product unless otherwise stated.
          </p>
          <div className="flex items-center space-x-4">
            <Link href="/learn" className="hover:text-gray-900 underline">
              Academy
            </Link>
            <Link href="/dashboard" className="hover:text-gray-900 underline">
              Dashboard
            </Link>
            <a
              href="https://testnet.monadvision.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-gray-900 underline"
            >
              MonadVision ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
