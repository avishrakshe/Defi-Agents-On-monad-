"use client";

import React from "react";
import { AgentData } from "../lib/contracts";

interface AgentRegistryProps {
  agents: AgentData[];
  onSelectAgent: (agent: AgentData) => void;
  onOpenRegisterModal?: () => void;
}

export const AgentRegistry: React.FC<AgentRegistryProps> = ({
  agents,
  onSelectAgent,
  onOpenRegisterModal
}) => {
  return (
    <section id="registry" className="pt-6 pb-20 px-4 sm:px-8 max-w-7xl mx-auto">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 sm:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                ONCHAIN REGISTRY
              </span>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-0.5 rounded-full">
                {agents.length} DeFi agents
              </span>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-950 tracking-tight">
              Agent Registry
            </h2>
          </div>

          {onOpenRegisterModal && (
            <button
              onClick={onOpenRegisterModal}
              className="btn-monad-lime text-xs sm:text-sm font-bold py-2.5 px-5 shadow-sm hover:shadow-md transition-all flex items-center space-x-2 self-start sm:self-auto"
            >
              <span>+</span>
              <span>Register Custom Agent</span>
            </button>
          )}
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {agents.map((agent) => {
            const shortOwner = agent.owner
              ? `${agent.owner.slice(0, 6)}...${agent.owner.slice(-4)}`
              : "0x3C44...93BC";
            const isCustom = agent.id > 3;

            return (
              <div
                key={agent.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between hover:border-gray-400/80 hover:shadow-md transition-all group"
              >
                <div>
                  {/* Top Bar: Title & Number Badge */}
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-black transition-colors leading-snug">
                        {agent.name}
                      </h3>
                      {isCustom && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200/80">
                          Community Agent
                        </span>
                      )}
                    </div>
                    <span className="w-7 h-7 rounded-full bg-[#f1fcc7] text-gray-900 font-bold text-xs flex items-center justify-center border border-[#d6f864] flex-shrink-0 ml-2">
                      #{agent.id}
                    </span>
                  </div>

                  {/* Skill and Onchain Address */}
                  <div className="text-xs font-mono text-gray-400 mb-4 flex items-center space-x-1.5">
                    <span>{agent.skill}</span>
                    <span>•</span>
                    <span className="hover:text-gray-600 transition-colors" title={agent.owner}>
                      {shortOwner}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-600 leading-relaxed mb-5 line-clamp-3">
                    {agent.description}
                  </p>

                  {/* Data Source Badge */}
                  <div className="mb-5">
                    <span className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-50 border border-gray-200/80 px-2.5 py-1 rounded-md">
                      {agent.dataSource}
                    </span>
                  </div>
                </div>

                <div>
                  {/* Stats Row: Price, Stake, Reputation */}
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs mb-4">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Price</span>
                      <span className="font-semibold text-gray-900">{agent.priceUSDC}</span>
                    </div>

                    <div className="text-center">
                      <span className="text-gray-400 block text-[10px]">Stake</span>
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        {agent.stakedUSDC} tUSDC
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-gray-400 block text-[10px]">Reputation</span>
                      <span className="font-semibold text-gray-800">
                        {agent.feedbackCount > 0 ? `${agent.avgScore}/100` : "No reviews yet"}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => onSelectAgent(agent)}
                    className="w-full bg-[#f8f9fa] hover:bg-[#ccff00] text-gray-800 hover:text-black font-semibold text-xs py-2.5 rounded-xl border border-gray-200 hover:border-[#b8e600] transition-all flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <span>Test Agent Directly</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
