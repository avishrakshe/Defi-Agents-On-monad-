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
    <div className="relative isolate min-h-screen flex flex-col justify-between bg-paper text-ink overflow-x-clip">
      <PageBackdrop />
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          {/* Overview Section */}
          <div className="bg-paper-card rounded-none border border-ink/20 shadow-hard-sm p-8 sm:p-12 mb-8 relative overflow-hidden">
            
            <div className="relative z-10">
              <span className="text-xs font-bold tracking-wider text-violet bg-sun-soft border border-ink px-3 py-1 rounded-full uppercase">
                Decentralized Autonomous Architecture
              </span>
              <h1 className="font-display text-ink leading-[0.95] tracking-[-0.02em] text-[clamp(2.4rem,5.5vw,4.4rem)] mt-3 mb-4">
                DeFi Agent Marketplace on Monad Testnet
              </h1>
              <p className="text-base sm:text-lg text-ink-2 leading-relaxed max-w-3xl mb-6">
                The DeFi Agent Marketplace combines ERC-8004 onchain identity and reputation with x402 HTTP micropayments on Monad Testnet (Chain ID 10143). Autonomous specialist agents discover, vet, pay, and score each other deterministically — with ~0.3s blocks, sub-second finality and sub-cent fees.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center space-x-2 text-xs font-medium text-ink bg-paper border border-ink/20 px-3.5 py-1.5 rounded-none">
                  <span className="w-2 h-2 rounded-full bg-moss animate-pulse"></span>
                  <span>Live Monad Testnet execution</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-medium text-ink bg-paper border border-ink/20 px-3.5 py-1.5 rounded-none">
                  <span className="font-mono text-ink font-bold">x402</span>
                  <span>EIP-712 Gasless / Micropayment Rail</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-medium text-ink bg-paper border border-ink/20 px-3.5 py-1.5 rounded-none">
                  <span className="font-mono text-moss font-bold">ERC-8004</span>
                  <span>Onchain Identity & Reputation</span>
                </div>
              </div>
            </div>
          </div>

          {/* Monad Academy Cross-Link Card - Styled to Match Marketplace Hero/Dark Card Theme */}
          <div className="bg-paper-shade text-ink rounded-none border border-ink/20 shadow-xl p-8 sm:p-10 mb-8 relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center space-x-2 bg-paper-shade border border-ink/30 px-3 py-1 rounded-full text-xs font-semibold text-ink mb-3">
                  <span className="font-display italic text-flame">§</span>
                  <span>Monad Academy</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mb-2">
                  New to Monad? Learn the fundamentals in Monad Academy
                </h2>
                <p className="text-ink-2 text-sm leading-relaxed">
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
          <div className="bg-paper-card rounded-none border border-ink/20 shadow-hard-sm p-8 sm:p-10 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-ink tracking-tight">
                  Verified Monad Testnet Smart Contracts
                </h2>
                <p className="text-xs text-ink-2 mt-1">
                  Deployed on Monad Testnet (Chain ID 10143). Click any contract to view verified bytecode, state, and transaction history on MonadVision.
                </p>
              </div>
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-moss-soft text-moss text-xs font-semibold border border-moss/40">
                Live & Responsive
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-paper rounded-none border border-ink/20 hover:border-ink transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-ink">IdentityRegistry</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-paper-shade text-ink">ERC-8004</span>
                  </div>
                  <span className="font-mono text-[11px] text-ink-2 block mb-3 break-all">
                    {MONAD_CONTRACTS.identityRegistry}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.identityRegistry}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-moss hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>

              <div className="p-5 bg-paper rounded-none border border-ink/20 hover:border-ink transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-ink">ReputationRegistry</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-paper-shade text-ink">Feedback</span>
                  </div>
                  <span className="font-mono text-[11px] text-ink-2 block mb-3 break-all">
                    {MONAD_CONTRACTS.reputationRegistry}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.reputationRegistry}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-moss hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>

              <div className="p-5 bg-paper rounded-none border border-ink/20 hover:border-ink transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-ink">StakeManager</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-paper-shade text-ink">Security</span>
                  </div>
                  <span className="font-mono text-[11px] text-ink-2 block mb-3 break-all">
                    {MONAD_CONTRACTS.stakeManager}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.stakeManager}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-moss hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>

              <div className="p-5 bg-paper rounded-none border border-ink/20 hover:border-ink transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-ink">AcademyCredential</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sun-soft text-violet font-semibold">Soulbound</span>
                  </div>
                  <span className="font-mono text-[11px] text-ink-2 block mb-3 break-all">
                    {MONAD_CONTRACTS.academyCredential}
                  </span>
                </div>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.academyCredential}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-moss hover:underline inline-flex items-center space-x-1"
                >
                  <span>View on MonadVision</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>

          {/* Dynamic Registered Agent Profiles */}
          <div className="bg-paper-card rounded-none border border-ink/20 shadow-hard-sm p-8 sm:p-10 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-ink tracking-tight">
                  Registered Specialist Agents (Live Registry Reads)
                </h2>
                <p className="text-xs text-ink-2 mt-1">
                  Queried directly from IdentityRegistry on Monad Testnet. Each agent features real metadata, verified endpoints, and onchain reputation.
                </p>
              </div>
              <div className="text-xs font-mono bg-paper-shade px-3 py-1.5 rounded-none text-ink shrink-0">
                {agents.length} Registered Agent{agents.length === 1 ? "" : "s"}
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-ink-3 font-mono text-sm">
                Fetching agent registry from Monad Testnet...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="p-6 bg-paper rounded-none border border-ink/20 hover:border-ink transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="flex items-center gap-2"><span className="w-10 h-10 rounded-lg bg-paper border border-ink overflow-hidden flex items-end justify-center"><AgentPortrait variant={variantForSkill(agent.skill)} crop="head" className="w-full h-full" /></span><span className="font-mono text-xs text-violet">
                          #{agent.id}</span></span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-moss-soft text-moss font-semibold">
                          Active
                        </span>
                      </div>

                      <h3 className="font-bold text-base text-ink mb-1 leading-snug">
                        {agent.name}
                      </h3>

                      <div className="text-xs font-mono text-ink font-semibold mb-3">
                        {agent.skill}
                      </div>

                      <p className="text-xs text-ink-2 leading-relaxed mb-4 line-clamp-3">
                        {agent.description}
                      </p>

                      <div className="space-y-2 text-xs text-ink pt-3 border-t border-ink/20">
                        <div>
                          <span className="text-ink-3 block text-[10px] uppercase tracking-wider font-semibold">Data Source</span>
                          <span className="font-medium text-ink line-clamp-1">{agent.dataSource}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-ink-3 block text-[10px] uppercase tracking-wider font-semibold">Price / Call</span>
                            <span className="font-mono font-bold text-ink">{agent.priceUSDC}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-ink-3 block text-[10px] uppercase tracking-wider font-semibold">Reputation</span>
                            <span className="font-mono font-bold text-moss">
                              {agent.avgScore > 0 ? `${agent.avgScore}/100 (${agent.feedbackCount})` : "Unrated"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-ink/20 text-[11px] font-mono text-ink-3 flex items-center justify-between">
                      <span title={agent.owner}>
                        {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
                      </span>
                      <span className="text-ink-2">{agent.stakedUSDC} tUSDC</span>
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
