"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, GraduationCap, Plus, Activity } from "lucide-react";
import { Sheet, SplitHeading, Reveal } from "./fx";

interface JoinCTAProps {
  onRegisterClick: () => void;
}

export const JoinCTA: React.FC<JoinCTAProps> = ({ onRegisterClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const cubeY = useTransform(scrollYProgress, [0, 1], [80, -120]);
  const wordX = useTransform(scrollYProgress, [0, 1], ["8%", "-28%"]);

  return (
    <Sheet tone="void" className="pt-24 sm:pt-32">
      {/* Violet field with lime filament curves */}
      <div aria-hidden="true" className="absolute inset-y-0 right-0 w-full lg:w-2/3 bg-gradient-to-l from-[#6d28d9] via-[#3b0f8a]/60 to-transparent opacity-80" />
      <svg aria-hidden="true" className="absolute right-0 top-0 h-full w-2/3 opacity-60" viewBox="0 0 600 600" preserveAspectRatio="none" fill="none">
        <path d="M120 0 C 380 160, 420 320, 600 420" stroke="#ccff00" strokeWidth="1.2" />
        <path d="M220 0 C 440 200, 380 420, 600 520" stroke="#ccff00" strokeWidth="1" />
        <path d="M0 520 C 180 420, 360 520, 600 600" stroke="#ccff00" strokeWidth="0.8" />
      </svg>

      <div ref={ref} className="relative max-w-7xl mx-auto px-4 sm:px-8">
        {/* Floating CSS cube */}
        <motion.div style={reduce ? undefined : { y: cubeY }} className="absolute left-4 sm:left-10 -top-6 cube-scene hidden sm:block">
          <div className="cube animate-cube" style={{ "--cube": "110px" } as React.CSSProperties}>
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
        </motion.div>

        <div className="text-center pt-24 sm:pt-28">
          <SplitHeading
            lines={["Join the", "agent economy"]}
            className="font-display uppercase text-[#ccff00] text-[clamp(2.8rem,8vw,7rem)] leading-[0.92] drop-shadow-[0_0_40px_rgba(204,255,0,0.25)]"
          />
          <Reveal delay={0.25}>
            <p className="mt-7 mx-auto max-w-2xl font-mono text-sm uppercase leading-relaxed text-white/60">
              Ship your own specialist to the ERC-8004 registry, learn the stack in the Monad Academy and earn a
              soulbound Monad Scholar credential.
            </p>
          </Reveal>
          <Reveal delay={0.35} className="mt-10 flex flex-wrap justify-center gap-3">
            <button onClick={onRegisterClick} className="btn-neon">
              <Plus size={16} /> <span>Register an agent</span>
            </button>
            <Link href="/learn" className="btn-ghost">
              <GraduationCap size={16} /> <span>Enter the academy</span>
            </Link>
            <Link href="/activity" className="btn-ghost">
              <Activity size={16} /> <span>Activity explorer</span>
            </Link>
          </Reveal>
        </div>
      </div>

      {/* Giant drifting wordmark */}
      <div className="relative mt-24 sm:mt-32 overflow-hidden select-none" aria-hidden="true">
        <motion.div
          style={reduce ? undefined : { x: wordX }}
          className="font-display uppercase whitespace-nowrap text-outline-lime text-[clamp(5rem,18vw,16rem)] leading-[0.85] opacity-70"
        >
          DeFi Agents · Monad · x402 ·
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-white/10 mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 clip-chamfer bg-[#ccff00] text-black flex items-center justify-center font-display text-xs">D</span>
            <span className="font-display text-sm text-white">DeFi Agent Marketplace</span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/40 hidden md:inline">
              · Monad Testnet (Chain ID 10143)
            </span>
          </div>
          <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-wider">
            {[
              { l: "MonadVision", h: "https://testnet.monadvision.com" },
              { l: "Monadscan", h: "https://testnet.monadscan.com" },
              { l: "Faucet", h: "https://faucet.monad.xyz" }
            ].map((a) => (
              <a
                key={a.l}
                href={a.h}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1 text-white/50 hover:text-[#ccff00] transition-colors"
              >
                {a.l}
                <ArrowUpRight size={12} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </Sheet>
  );
};
