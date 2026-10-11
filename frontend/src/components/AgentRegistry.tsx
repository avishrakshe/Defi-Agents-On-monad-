"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Plus } from "lucide-react";
import { AgentData } from "../lib/contracts";
import { Sheet, SectionLabel, SplitHeading, Reveal } from "./fx";
import { AgentPortrait, variantForSkill } from "./AgentPortrait";

interface AgentRegistryProps {
  agents: AgentData[];
  onSelectAgent: (agent: AgentData) => void;
  onOpenRegisterModal?: () => void;
}

/** The registry as a printed ledger: one row per onchain agent, read live from IdentityRegistry. */
export const AgentRegistry: React.FC<AgentRegistryProps> = ({ agents, onSelectAgent, onOpenRegisterModal }) => {
  const reduce = useReducedMotion();

  return (
    <Sheet id="registry" tone="sheet" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10">
          <div>
            <SectionLabel index="04">Onchain registry</SectionLabel>
            <SplitHeading
              lines={["The agent", { text: "ledger.", className: "italic text-violet" }]}
              className="mt-6 font-display text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.92] tracking-[-0.02em]"
            />
          </div>
          <Reveal delay={0.15} className="flex flex-col items-start lg:items-end gap-4">
            <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink-2">
              {agents.length} listings · IdentityRegistry · ERC-8004
            </span>
            {onOpenRegisterModal && (
              <button onClick={onOpenRegisterModal} className="btn-neon">
                <Plus size={15} />
                <span>List your agent</span>
              </button>
            )}
          </Reveal>
        </div>

        <div className="border-[1.5px] border-ink bg-paper-card">
          {/* Column heads (desktop) */}
          <div className="hidden md:grid grid-cols-[56px_minmax(0,2.2fr)_minmax(0,1.6fr)_90px_100px_minmax(0,1.3fr)_120px] items-center px-4 py-2.5 border-b-[1.5px] border-ink bg-paper-shade font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-2">
            <span>Nº</span>
            <span>Agent</span>
            <span>Data source</span>
            <span>Price</span>
            <span>Stake</span>
            <span>Reputation</span>
            <span className="text-right">Action</span>
          </div>

          {agents.map((agent, idx) => {
            const rated = agent.feedbackCount > 0;
            const isCustom = agent.id > 3;
            return (
              <motion.div
                key={agent.id}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: idx * 0.06 }}
                className="group grid grid-cols-[56px_1fr] md:grid-cols-[56px_minmax(0,2.2fr)_minmax(0,1.6fr)_90px_100px_minmax(0,1.3fr)_120px] items-center gap-y-3 px-4 py-4 border-b border-ink/15 last:border-b-0 hover:bg-sun-soft transition-colors"
              >
                <span className="font-display text-3xl leading-none self-start md:self-center">{String(agent.id).padStart(2, "0")}</span>

                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-12 h-12 shrink-0 border-[1.5px] border-ink bg-paper overflow-hidden flex items-end justify-center transition-transform group-hover:-rotate-3">
                    <AgentPortrait variant={variantForSkill(agent.skill)} crop="head" className="w-full h-full" animated={false} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] font-semibold leading-tight truncate">{agent.name}</span>
                      {isCustom && <span className="font-mono text-[9px] uppercase px-1 border border-violet text-violet shrink-0">community</span>}
                    </div>
                    <div className="font-mono text-[11px] text-ink-2 truncate" title={agent.owner}>
                      {agent.skill} · {agent.owner.slice(0, 6)}…{agent.owner.slice(-4)}
                    </div>
                  </div>
                </div>

                <span className="col-span-2 md:col-span-1 text-[13px] text-ink-2 leading-snug md:pr-4 line-clamp-2">{agent.dataSource}</span>
                <span className="font-mono text-[13px] col-start-2 md:col-start-auto">
                  <span className="md:hidden text-ink-3 mr-2">price</span>
                  {agent.priceUSDC}
                </span>
                <span className="font-mono text-[13px] col-start-2 md:col-start-auto">
                  <span className="md:hidden text-ink-3 mr-2">stake</span>
                  {agent.stakedUSDC} USDC
                </span>

                <div className="col-start-2 md:col-start-auto md:pr-4">
                  <div className="flex items-baseline justify-between font-mono text-[12px]">
                    <span>{rated ? `${agent.avgScore}/100` : "unrated"}</span>
                    <span className="text-ink-3">{agent.feedbackCount} rev</span>
                  </div>
                  <div className="mt-1 h-2.5 border border-ink bg-paper overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: rated ? `${agent.avgScore}%` : "0%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, delay: 0.2 + idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full halftone-violet"
                    />
                  </div>
                </div>

                <div className="col-start-2 md:col-start-auto md:text-right">
                  <button onClick={() => onSelectAgent(agent)} className="btn-ghost btn-sm">
                    <span>Run</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}

          {agents.length === 0 && <div className="px-4 py-12 text-center font-mono text-[12px] text-ink-2">Reading IdentityRegistry on Monad…</div>}
        </div>

        <p className="mt-4 font-mono text-[11px] text-ink-3">
          Reputation = average of onchain review scores in ReputationRegistry. Stake from StakeManager. Updated on every page load.
        </p>
      </div>
    </Sheet>
  );
};
