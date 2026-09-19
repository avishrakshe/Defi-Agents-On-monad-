"use client";

import React from "react";
import { AgentData } from "../lib/contracts";

interface HeroSectionProps {
  agents: AgentData[];
  onRunClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ agents, onRunClick }) => {
  const auditor = agents.find((a) => a.skill === "contract-audit");
  const riskScorer = agents.find((a) => a.skill === "token-risk-score");
  const gasAgent = agents.find((a) => a.skill === "gas-timing");

  const renderScore = (agent?: AgentData) => {
    if (!agent || agent.feedbackCount === 0) {
      return (
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-gray-400">—</span>
          <span className="text-xs text-gray-400 mt-1">No reviews yet</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center">
        <span className="text-2xl font-extrabold text-emerald-600">{agent.avgScore}/100</span>
        <span className="text-xs text-gray-500 mt-1">{agent.feedbackCount} feedback</span>
      </div>
    );
  };

  return (
    <section className="pt-8 pb-12 px-4 sm:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Hero Text */}
        <div className="lg:col-span-7 flex flex-col items-start">
          {/* Top Mode Badges */}
          <div className="flex flex-wrap gap-2.5 mb-6">
            <span className="pill-badge hover:bg-gray-200/80 transition-colors cursor-default">
              Mode A: Autonomous
            </span>
            <span className="pill-badge hover:bg-gray-200/80 transition-colors cursor-default">
              Mode B: Your Wallet
            </span>
            <span className="pill-badge hover:bg-gray-200/80 transition-colors cursor-default">
              x402 Micropayments
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-950 tracking-tight leading-[1.08] mb-4">
            Agents pay agents. <br />
            <span className="text-gray-400">No wallet required.</span>
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-gray-600 max-w-xl leading-relaxed mb-8">
            Run tasks instantly — the orchestrator wallet pays specialists via EIP-3009.
            Optionally connect MetaMask to pay with your own funds.
          </p>

          {/* Primary CTA Button */}
          <button
            onClick={onRunClick}
            className="btn-monad-lime text-base font-bold py-3.5 px-8 shadow-md hover:shadow-lg transition-all"
          >
            Run without connecting
          </button>
        </div>

        {/* Right Column: Agent Reputation Card */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-7 sm:p-8 transition-all hover:border-gray-300">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Agent Reputation</h2>
              <p className="text-xs text-gray-500 mt-1">Live onchain feedback scores</p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 pb-2 border-t border-gray-100">
              {/* Col 1: Smart Contract Auditor */}
              <div className="flex flex-col items-center text-center">
                <div className="h-10 flex items-center justify-center">
                  {renderScore(auditor)}
                </div>
                <span className="text-[11px] font-medium text-gray-500 mt-3 leading-tight">
                  Smart Contract Auditor
                </span>
              </div>

              {/* Col 2: Token Risk Scorer */}
              <div className="flex flex-col items-center text-center border-x border-gray-100 px-2">
                <div className="h-10 flex items-center justify-center">
                  {renderScore(riskScorer)}
                </div>
                <span className="text-[11px] font-medium text-gray-500 mt-3 leading-tight">
                  Token Risk Scorer
                </span>
              </div>

              {/* Col 3: Gas & Timing Agent */}
              <div className="flex flex-col items-center text-center">
                <div className="h-10 flex items-center justify-center">
                  {renderScore(gasAgent)}
                </div>
                <span className="text-[11px] font-medium text-gray-500 mt-3 leading-tight">
                  Gas & Timing Agent
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
