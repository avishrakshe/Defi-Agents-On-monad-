"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { AgentData, rankedScore, splitLabel } from "../lib/contracts";
import { AgentPortrait, PortraitVariant } from "./AgentPortrait";
import { Sheet, SectionLabel, SplitHeading, Reveal } from "./fx";

interface AgentLineupProps {
  agents: AgentData[];
  onSelectAgent: (agent: AgentData) => void;
}

const CREW: { skill: string; variant: PortraitVariant; codename: string; role: string; bg: string; line: string }[] = [
  { skill: "contract-audit", variant: "auditor", codename: "AUDIT", role: "Contract Auditor", bg: "halftone-violet", line: "Reads verified source and bytecode, flags what can hurt you." },
  { skill: "token-risk-score", variant: "risk", codename: "RISK", role: "Token Risk Scorer", bg: "halftone-flame", line: "Finds mint, pause and blacklist levers in any ERC-20." },
  { skill: "gas-timing", variant: "gas", codename: "GAS", role: "Gas Oracle", bg: "bg-sun-soft", line: "Measures block fullness and tells you when to send." },
  { skill: "whale-tracker", variant: "whale", codename: "WHALE", role: "Whale Sentinel", bg: "bg-moss-soft", line: "Watches where the big money moves, block by block." }
];

export const AgentLineup: React.FC<AgentLineupProps> = ({ agents, onSelectAgent }) => {
  const reduce = useReducedMotion();

  return (
    <Sheet tone="sheet" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-12">
          <div className="lg:col-span-7">
            <SectionLabel index="01">The specialists</SectionLabel>
            <SplitHeading
              lines={["Four agents,", { text: "one job each.", className: "italic text-violet" }]}
              className="mt-6 font-display text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.92] tracking-[-0.02em]"
            />
          </div>
          <Reveal delay={0.15} className="lg:col-span-5">
            <p className="text-[17px] leading-relaxed text-ink-2 border-l-[1.5px] border-ink pl-5">
              Every specialist has an onchain identity, its own owner and payee, a USDC stake and a price per call. Reviews from paying
              wallets and from the operator are counted separately. Pick one to run it.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {CREW.map((c, i) => {
            const agent = agents.find((a) => a.skill === c.skill);
            const ranked = agent ? rankedScore(agent) : null;
            return (
              <motion.div
                key={c.skill}
                initial={reduce ? false : { opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  onClick={() => agent && onSelectAgent(agent)}
                  disabled={!agent}
                  aria-label={`Run the ${c.role}`}
                  className="group block w-full text-left border-[1.5px] border-ink bg-paper-card transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard"
                >
                  {/* File tab */}
                  <div className="flex items-center justify-between px-3 py-2 border-b-[1.5px] border-ink font-mono text-[11px] uppercase tracking-[0.14em]">
                    <span>
                      Nº {String(agent?.id ?? i + 1).padStart(2, "0")} — {c.codename}
                    </span>
                    <span className="flex items-center gap-1 text-ink-2 group-hover:text-ink">
                      run <ArrowUpRight size={13} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  {/* Riso print */}
                  <div className={`relative aspect-[4/4.2] overflow-hidden border-b-[1.5px] border-ink ${c.bg}`}>
                    <div className="absolute inset-x-0 bottom-0 top-6 flex items-end justify-center transition-transform duration-500 ease-out group-hover:scale-[1.04]">
                      <AgentPortrait variant={c.variant} className="w-[92%] h-full" />
                    </div>
                    {ranked !== null && (
                      <span className="absolute top-3 right-3 stamp border-ink bg-paper-card animate-stamp">
                        {ranked}/100
                      </span>
                    )}
                  </div>

                  {/* Dossier */}
                  <div className="p-4">
                    <div className="font-display text-[1.75rem] leading-none">{c.role}</div>
                    <p className="mt-2 text-[13.5px] leading-snug text-ink-2 min-h-[2.6rem]">{c.line}</p>
                    <dl className="mt-4 grid grid-cols-3 border-t border-ink/20 pt-3 font-mono text-[11px]">
                      <div>
                        <dt className="text-ink-3 uppercase">Price</dt>
                        <dd className="text-ink mt-0.5">{agent?.priceUSDC ?? "$0.001"}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-3 uppercase">Indep.</dt>
                        <dd className="text-ink mt-0.5">{agent ? splitLabel(agent.independent) : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-3 uppercase">Operator</dt>
                        <dd className="text-ink mt-0.5">{agent ? splitLabel(agent.operator) : "—"}</dd>
                      </div>
                    </dl>
                    {agent && ranked === null && (
                      <p className="mt-2 font-mono text-[10px] text-ink-3">not enough independent reviews yet</p>
                    )}
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
};
