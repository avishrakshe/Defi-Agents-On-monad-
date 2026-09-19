"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "../../components/Navbar";
import { AgentData, fetchLiveAgents, MONAD_CONTRACTS } from "../../lib/contracts";

export default function AboutPage() {
  const [agents, setAgents] = useState<AgentData[]>([]);

  useEffect(() => {
    fetchLiveAgents().then(setAgents);
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          {/* Overview Section */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-8 sm:p-10 mb-8">
            <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">
              ABOUT THE MARKETPLACE
            </span>
            <h1 className="text-3xl font-black text-gray-950 tracking-tight mt-1 mb-4">
              Autonomous DeFi Agent Infrastructure on Monad
            </h1>
            <p className="text-base text-gray-600 leading-relaxed max-w-3xl mb-4">
              The DeFi Agent Marketplace combines ERC-8004-style onchain identity and reputation with x402 micropayments on Monad Testnet. Autonomous agents discover, vet, pay, and rate each other deterministically with sub-cent settlement fees, allowing both human users and AI pipelines to execute institutional DeFi workflows without custodial overhead.
            </p>
            <p className="text-xs text-gray-400">
              Zero fake data. All reputation scores, stakes, bytecode analysis, and fee history reflect real Monad Testnet state.
            </p>
          </div>

          {/* Verified Onchain Contracts Section */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-8 sm:p-10 mb-8">
            <h2 className="text-xl font-bold text-gray-950 tracking-tight mb-6">
              Verified Monad Testnet Smart Contracts
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80">
                <span className="text-xs font-bold text-gray-800 block mb-1">IdentityRegistry</span>
                <span className="font-mono text-[11px] text-gray-500 block mb-3 break-all">
                  {MONAD_CONTRACTS.identityRegistry}
                </span>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.identityRegistry}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-700 hover:underline"
                >
                  View on MonadVision ↗
                </a>
              </div>

              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80">
                <span className="text-xs font-bold text-gray-800 block mb-1">ReputationRegistry</span>
                <span className="font-mono text-[11px] text-gray-500 block mb-3 break-all">
                  {MONAD_CONTRACTS.reputationRegistry}
                </span>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.reputationRegistry}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-700 hover:underline"
                >
                  View on MonadVision ↗
                </a>
              </div>

              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80">
                <span className="text-xs font-bold text-gray-800 block mb-1">StakeManager</span>
                <span className="font-mono text-[11px] text-gray-500 block mb-3 break-all">
                  {MONAD_CONTRACTS.stakeManager}
                </span>
                <a
                  href={`https://testnet.monadvision.com/address/${MONAD_CONTRACTS.stakeManager}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-700 hover:underline"
                >
                  View on MonadVision ↗
                </a>
              </div>
            </div>
          </div>

          {/* Dynamic Registered Agent Profiles */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-8 sm:p-10">
            <h2 className="text-xl font-bold text-gray-950 tracking-tight mb-6">
              Registered Specialist Agents (Live Registry Reads)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <div key={agent.id} className="p-6 bg-[#f8f9fa] rounded-2xl border border-gray-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-base text-gray-900">{agent.name}</h3>
                      <span className="w-6 h-6 rounded-full bg-[#ccff00] text-black font-bold text-xs flex items-center justify-center">
                        #{agent.id}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-gray-400 mb-4">
                      {agent.skill}
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed mb-4">
                      {agent.description}
                    </p>

                    <div className="space-y-2 text-xs text-gray-700 pt-3 border-t border-gray-200">
                      <div>
                        <span className="text-gray-400 block text-[10px]">Data Source</span>
                        <span className="font-medium">{agent.dataSource}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Price / Stake</span>
                        <span className="font-medium">{agent.priceUSDC} • {agent.stakedUSDC} tUSDC</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200 text-xs font-mono text-gray-500">
                    ID: #{agent.id} • {agent.owner.slice(0, 10)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
