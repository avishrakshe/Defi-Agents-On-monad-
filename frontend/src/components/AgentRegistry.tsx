"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, ScanSearch, Fuel, Waves, Bot, ArrowRight, Plus, LucideIcon } from "lucide-react";
import { AgentData } from "../lib/contracts";
import { Sheet, SectionLabel, SplitHeading, Reveal, TiltCard } from "./fx";
import { AgentPortrait, variantForSkill } from "./AgentPortrait";

interface AgentRegistryProps {
  agents: AgentData[];
  onSelectAgent: (agent: AgentData) => void;
  onOpenRegisterModal?: () => void;
}

const SKILL_ICONS: Record<string, LucideIcon> = {
  "contract-audit": ShieldCheck,
  "token-risk-score": ScanSearch,
  "gas-timing": Fuel,
  "whale-tracker": Waves
};

export const AgentRegistry: React.FC<AgentRegistryProps> = ({
  agents,
  onSelectAgent,
  onOpenRegisterModal
}) => {
  const reduce = useReducedMotion();

  return (
    <Sheet id="registry" tone="sheet" className="pt-24 pb-28 sm:pt-32 sm:pb-36">
      <div aria-hidden="true" className="absolute inset-0 bg-blueprint opacity-70" />
      <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 top-0 w-[900px] h-[300px] bg-[#ccff00] opacity-[0.07] blur-[120px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-14">
          <div>
            <SectionLabel index="003">Onchain registry</SectionLabel>
            <SplitHeading
              lines={["The agent", { text: "roster", className: "text-outline-lime" }]}
              className="mt-8 font-display uppercase text-[clamp(2.6rem,7vw,6rem)] leading-[0.92]"
            />
          </div>

          <Reveal delay={0.15} className="flex flex-col items-start lg:items-end gap-5">
            <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] animate-pulse" />
              {agents.length} DeFi agents · IdentityRegistry
            </div>
            {onOpenRegisterModal && (
              <button onClick={onOpenRegisterModal} className="btn-neon">
                <Plus size={16} />
                <span>Register custom agent</span>
              </button>
            )}
          </Reveal>
        </div>

        {/* Agents grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {agents.map((agent, idx) => {
            const shortOwner = agent.owner
              ? `${agent.owner.slice(0, 6)}...${agent.owner.slice(-4)}`
              : "0x3C44...93BC";
            const isCustom = agent.id > 3;
            const Icon = SKILL_ICONS[agent.skill] || Bot;
            const hasScore = agent.feedbackCount > 0;

            return (
              <motion.div
                key={agent.id}
                initial={reduce ? false : { opacity: 0, y: 60, rotateX: -12 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.9, delay: (idx % 3) * 0.1, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformPerspective: 1000 }}
              >
                <TiltCard className="h-full clip-chamfer-lg">
                  <div className="h-full clip-chamfer-lg bg-gradient-to-br from-white/[0.16] via-white/[0.05] to-[#ccff00]/20 p-px transition-colors">
                    <div className="clip-chamfer-lg h-full bg-[#111112] p-6 sm:p-7 flex flex-col">
                      {/* Top bar */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="relative w-16 h-16 clip-chamfer bg-gradient-to-br from-[#ccff00] to-[#8be000] p-px transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-105">
                          <div className="clip-chamfer w-full h-full bg-[#141416] overflow-hidden flex items-end justify-center">
                            <AgentPortrait variant={variantForSkill(agent.skill)} crop="head" className="w-full h-full" />
                          </div>
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded bg-[#ccff00] text-black flex items-center justify-center">
                            <Icon size={12} strokeWidth={2.6} />
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="font-mono text-xs text-white/40">#{String(agent.id).padStart(2, "0")}</span>
                          {isCustom && (
                            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#836ef9]/20 text-[#c4b8ff] border border-[#836ef9]/40">
                              Community
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="mt-6 font-display uppercase text-xl leading-tight text-white">{agent.name}</h3>
                      <div className="mt-2 font-mono text-[11px] text-white/40 flex items-center gap-1.5">
                        <span className="text-[#ccff00]/80">{agent.skill}</span>
                        <span>•</span>
                        <span title={agent.owner}>{shortOwner}</span>
                      </div>

                      <p className="mt-4 text-sm text-white/55 leading-relaxed line-clamp-3">{agent.description}</p>

                      <div className="mt-4">
                        <span className="inline-flex font-mono text-[10px] uppercase tracking-wider text-white/50 border border-white/10 bg-white/[0.03] px-2.5 py-1 rounded">
                          {agent.dataSource}
                        </span>
                      </div>

                      <div className="mt-auto pt-6">
                        {/* Reputation meter */}
                        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider">
                          <span className="text-white/40">Reputation</span>
                          <span className={hasScore ? "text-[#ccff00]" : "text-white/40"}>
                            {hasScore ? `${agent.avgScore}/100 · ${agent.feedbackCount} fb` : "No reviews yet"}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: hasScore ? `${agent.avgScore}%` : "0%" }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full bg-gradient-to-r from-[#836ef9] to-[#ccff00] shadow-[0_0_10px_rgba(204,255,0,0.5)]"
                          />
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3 font-mono text-xs">
                          <div className="border border-white/10 rounded px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-white/40">Price</div>
                            <div className="text-white mt-0.5">{agent.priceUSDC}</div>
                          </div>
                          <div className="border border-white/10 rounded px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-white/40">Stake</div>
                            <div className="text-emerald-300 mt-0.5">{agent.stakedUSDC} tUSDC</div>
                          </div>
                        </div>

                        <button
                          onClick={() => onSelectAgent(agent)}
                          className="btn-ghost btn-sm mt-5 w-full"
                        >
                          <span>Test agent directly</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
};
