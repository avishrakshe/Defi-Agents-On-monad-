"use client";

import React, { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowDownRight } from "lucide-react";
import { AgentData } from "../lib/contracts";
import { GridPattern3D } from "./GridPattern3D";
import { AgentOrbit } from "./AgentOrbit";

interface HeroSectionProps {
  agents: AgentData[];
  onRunClick: () => void;
  onExploreClick?: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

const STATS = [
  { k: "300ms", v: "Block time" },
  { k: "$0.001", v: "Per agent call" },
  { k: "10K", v: "TPS target" },
  { k: "ERC-8004", v: "Agent identity" }
];

export const HeroSection: React.FC<HeroSectionProps> = ({ agents, onRunClick, onExploreClick }) => {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  // Scroll-out choreography: headline drifts up and widens, orbit sinks and dims
  const headY = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const headSpacing = useTransform(scrollYProgress, [0, 1], ["-0.02em", "0.08em"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const orbitY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const orbitScale = useTransform(scrollYProgress, [0, 1], [1, 0.86]);

  const liveCount = agents.length;

  return (
    <section
      ref={ref}
      className="relative overflow-clip bg-[#151516] text-white noise min-h-[100svh] pt-32 sm:pt-36 pb-28"
    >
      <GridPattern3D />

      {/* Ambient colour fields */}
      <div aria-hidden="true" className="absolute -left-40 top-1/3 w-[520px] h-[520px] rounded-full bg-[#6d28d9] opacity-30 blur-[120px]" />
      <div aria-hidden="true" className="absolute -right-32 top-20 w-[420px] h-[420px] rounded-full bg-[#ccff00] opacity-[0.12] blur-[110px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8">
        {/* Meta row */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-8 sm:mb-10"
        >
          <div className="flex items-center gap-3">
            <span className="stripe-bar" />
            <span className="font-mono text-[11px] sm:text-xs uppercase tracking-[0.2em] text-white/60">
              Monad Testnet · Chain 10143
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Mode A · Autonomous", "Mode B · Your wallet", "x402 Micropayments"].map((t) => (
              <span
                key={t}
                className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-white/70 border border-white/10 bg-white/[0.03] px-3 py-1 rounded-full"
              >
                {t}
              </span>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">
          {/* Headline column */}
          <motion.div style={reduce ? undefined : { y: headY, opacity: fade }} className="lg:col-span-7 relative z-10">
            <motion.h1
              style={reduce ? undefined : { letterSpacing: headSpacing }}
              className="font-display uppercase leading-[0.92] text-[clamp(3.2rem,9.5vw,8.5rem)] lg:text-[clamp(3.5rem,7.4vw,7.6rem)]"
            >
              {[
                { t: "Agents", c: "text-white" },
                { t: "pay", c: "text-[#ccff00]" },
                { t: "agents.", c: "text-white" }
              ].map((w, i) => (
                <span key={w.t} className="block overflow-hidden pb-[0.06em]">
                  <motion.span
                    className={`inline-block ${w.c}`}
                    initial={reduce ? false : { y: "105%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 1, delay: 0.15 + i * 0.12, ease: EASE }}
                  >
                    {w.t}
                  </motion.span>
                </span>
              ))}
            </motion.h1>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
              className="font-display uppercase text-outline text-[clamp(1.4rem,3.2vw,2.6rem)] leading-none mt-4"
            >
              No wallet required
            </motion.p>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.75, ease: EASE }}
              className="mt-7 max-w-xl text-base sm:text-lg text-white/60 leading-relaxed"
            >
              Run tasks instantly — the orchestrator wallet pays specialist agents via EIP-3009.
              Optionally connect MetaMask to pay with your own funds.
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9, ease: EASE }}
              className="mt-9 flex flex-wrap gap-3"
            >
              <button onClick={onRunClick} className="btn-neon group">
                <span>Run without connecting</span>
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
              {onExploreClick && (
                <button onClick={onExploreClick} className="btn-ghost group">
                  <span>Explore {liveCount > 0 ? liveCount : ""} agents</span>
                  <ArrowDownRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5" />
                </button>
              )}
            </motion.div>
          </motion.div>

          {/* Live agent network */}
          <motion.div
            style={reduce ? undefined : { y: orbitY, scale: orbitScale }}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.3, ease: EASE }}
            className="lg:col-span-5 relative"
          >
            <div className="absolute -top-2 right-2 sm:right-6 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 flex items-center gap-2 z-10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] animate-pulse" />
              Live onchain reputation
            </div>
            <AgentOrbit agents={agents} />
          </motion.div>
        </div>

        {/* Stat strip */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.05, ease: EASE }}
          className="mt-16 lg:mt-10 grid grid-cols-2 md:grid-cols-4 border-t border-white/10"
        >
          {STATS.map((s, i) => (
            <div
              key={s.k}
              className={`py-5 pr-4 ${i % 2 === 1 ? "pl-4 md:pl-6 border-l border-white/10" : ""} ${i === 2 ? "md:pl-6 md:border-l md:border-white/10" : ""}`}
            >
              <div className="font-display text-xl sm:text-3xl text-white whitespace-nowrap">{s.k}</div>
              <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-white/45 mt-1">
                {s.v}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
