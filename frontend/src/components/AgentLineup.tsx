"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { AgentData } from "../lib/contracts";
import { AgentPortrait, PortraitVariant } from "./AgentPortrait";
import { Sheet, SectionLabel, SplitHeading, Reveal, TiltCard } from "./fx";

interface AgentLineupProps {
  agents: AgentData[];
  onSelectAgent: (agent: AgentData) => void;
}

const CREW: { skill: string; variant: PortraitVariant; codename: string; role: string; bg: string; ink: string }[] = [
  { skill: "contract-audit", variant: "auditor", codename: "AUDIT-01", role: "Contract Auditor", bg: "#ccff00", ink: "#0b0b0b" },
  { skill: "token-risk-score", variant: "risk", codename: "RISK-02", role: "Token Risk Scorer", bg: "#6dff8f", ink: "#0b0b0b" },
  { skill: "gas-timing", variant: "gas", codename: "GAS-03", role: "Gas Oracle", bg: "#f2ff3a", ink: "#0b0b0b" },
  { skill: "whale-tracker", variant: "whale", codename: "WHALE-04", role: "Whale Sentinel", bg: "#a594ff", ink: "#0b0b0b" }
];

export const AgentLineup: React.FC<AgentLineupProps> = ({ agents, onSelectAgent }) => {
  const reduce = useReducedMotion();

  return (
    <Sheet tone="void" className="pt-24 pb-24 sm:pt-32 sm:pb-28">
      <div aria-hidden="true" className="absolute inset-0 bg-blueprint opacity-50" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div>
            <SectionLabel>Specialist crew</SectionLabel>
            <SplitHeading
              lines={["Meet the", { text: "agents", className: "text-[#ccff00]" }]}
              className="mt-8 font-display uppercase text-[clamp(2.8rem,8vw,6.5rem)] leading-[0.9]"
            />
          </div>
          <Reveal delay={0.15}>
            <p className="max-w-sm font-mono text-sm uppercase leading-relaxed text-white/50">
              Four autonomous specialists, each with an onchain identity, a live reputation score and a price per call.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {CREW.map((c, i) => {
            const agent = agents.find((a) => a.skill === c.skill);
            const hasScore = agent && agent.feedbackCount > 0;
            return (
              <motion.div
                key={c.skill}
                initial={reduce ? false : { opacity: 0, y: 80, rotate: i % 2 ? 3 : -3 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 1, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <TiltCard className="rounded-[2rem] overflow-hidden">
                  <button
                    onClick={() => agent && onSelectAgent(agent)}
                    disabled={!agent}
                    className="group/card relative block w-full text-left aspect-[4/5] rounded-[2rem] overflow-hidden"
                    style={{ background: c.bg, color: c.ink }}
                    aria-label={`Run the ${c.role}`}
                  >
                    {/* Card texture */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 opacity-[0.12]"
                      style={{
                        backgroundImage:
                          "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
                        backgroundSize: "28px 28px"
                      }}
                    />
                    <div aria-hidden="true" className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[120%] h-1/2 rounded-full bg-black/25 blur-3xl" />

                    {/* Header */}
                    <div className="absolute top-5 left-5 right-5 flex items-start justify-between z-10">
                      <div>
                        <div className="font-mono text-[11px] font-bold tracking-[0.2em]">{c.codename}</div>
                        <div className="font-mono text-[10px] uppercase tracking-wider opacity-60 mt-1">#{String(agent?.id ?? i + 1).padStart(2, "0")} · {agent?.priceUSDC ?? "$0.001"}/call</div>
                      </div>
                      <span className="w-9 h-9 rounded-full bg-black text-[#ccff00] flex items-center justify-center transition-transform duration-300 group-hover/card:rotate-45">
                        <ArrowUpRight size={16} />
                      </span>
                    </div>

                    {/* Portrait */}
                    <div className="absolute inset-x-0 bottom-0 top-12 flex items-end justify-center transition-transform duration-700 ease-out group-hover/card:scale-[1.06] group-hover/card:-translate-y-1">
                      <AgentPortrait variant={c.variant} className="w-[96%] h-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]" />
                    </div>

                    {/* Footer plate */}
                    <div className="absolute left-4 right-4 bottom-4 z-10 rounded-2xl bg-black/85 backdrop-blur px-4 py-3 text-white flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-display text-sm uppercase truncate">{c.role}</div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-white/45">{agent?.skill ?? c.skill}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-display text-lg leading-none ${hasScore ? "text-[#ccff00]" : "text-white/40"}`}>{hasScore ? agent!.avgScore : "—"}</div>
                        <div className="font-mono text-[9px] uppercase text-white/40">{hasScore ? `${agent!.feedbackCount} reviews` : "no reviews"}</div>
                      </div>
                    </div>
                  </button>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
};
