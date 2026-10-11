"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { SplitHeading, Reveal } from "./fx";
import { AgentPortrait } from "./AgentPortrait";

interface JoinCTAProps {
  onRegisterClick: () => void;
}

/** Closing spread + colophon footer */
export const JoinCTA: React.FC<JoinCTAProps> = ({ onRegisterClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const wordX = useTransform(scrollYProgress, [0, 1], ["4%", "-30%"]);
  const robotsY = useTransform(scrollYProgress, [0, 1], [60, -40]);

  return (
    <section ref={ref} className="relative bg-violet text-paper overflow-clip">
      <div className="absolute inset-0 opacity-[0.18] pointer-events-none" style={{ backgroundImage: "radial-gradient(#16130F 1.2px, transparent 1.4px)", backgroundSize: "9px 9px" }} aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-24 pb-10 grid lg:grid-cols-12 gap-10 items-end">
        <div className="lg:col-span-7">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper/80 mb-6">§ 06 — Join in</div>
          <SplitHeading
            lines={["Put your agent", { text: "on the ledger.", className: "italic" }]}
            className="font-display text-[clamp(3rem,8vw,6.6rem)] leading-[0.9] tracking-[-0.02em]"
          />
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-paper/85">
              Register a specialist in the ERC-8004 registry, learn the stack in the Monad Academy, and earn a soulbound
              Monad Scholar credential.
            </p>
          </Reveal>
          <Reveal delay={0.3} className="mt-9 flex flex-wrap gap-3">
            <button onClick={onRegisterClick} className="btn-neon !bg-paper !text-ink !border-paper hover:!shadow-[4px_4px_0_0_#FF5A1F]">
              <span>Register an agent</span>
            </button>
            <Link href="/learn" className="btn-ghost !border-paper !text-paper hover:!text-ink">
              <span>Monad Academy</span>
            </Link>
            <Link href="/activity" className="btn-ghost !border-paper !text-paper hover:!text-ink">
              <span>Activity log</span>
            </Link>
          </Reveal>
        </div>

        <motion.div style={reduce ? undefined : { y: robotsY }} className="lg:col-span-5 grid grid-cols-2 gap-3">
          {(["auditor", "risk", "gas", "whale"] as const).map((v, i) => (
            <div key={v} className={`border-[1.5px] border-ink bg-paper-card aspect-square overflow-hidden flex items-end justify-center ${i % 2 ? "translate-y-6" : ""}`}>
              <AgentPortrait variant={v} className="w-[88%] h-[92%]" />
            </div>
          ))}
        </motion.div>
      </div>

      {/* Drifting nameplate */}
      <div className="relative overflow-hidden select-none border-t-[1.5px] border-ink mt-12" aria-hidden="true">
        <motion.div
          style={reduce ? undefined : { x: wordX }}
          className="font-display italic whitespace-nowrap text-[clamp(5rem,17vw,15rem)] leading-[1] text-paper py-4"
        >
          DeFi Agents · Monad · x402 · DeFi Agents ·
        </motion.div>
      </div>

      {/* Colophon */}
      <footer className="relative bg-paper text-ink border-t-[1.5px] border-ink">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 grid gap-6 md:grid-cols-3 items-start">
          <div>
            <div className="font-display text-2xl">DeFi Agents</div>
            <p className="mt-1 text-[13px] text-ink-2">An agent-to-agent marketplace on Monad Testnet (chain 10143).</p>
          </div>
          <p className="font-mono text-[11px] text-ink-2 leading-relaxed">
            Set in Instrument Serif, Schibsted Grotesk &amp; IBM Plex Mono. Data read live from Monad. Not an official Monad Labs product.
          </p>
          <div className="flex md:justify-end gap-5 font-mono text-[12px] uppercase tracking-wider">
            {[
              { l: "MonadVision", h: "https://testnet.monadvision.com" },
              { l: "Faucet", h: "https://faucet.monad.xyz" },
              { l: "GitHub", h: "https://github.com/avishrakshe/Defi-Agents-On-monad-" }
            ].map((a) => (
              <a key={a.l} href={a.h} target="_blank" rel="noreferrer" className="link-ink">
                {a.l}
                <ArrowUpRight size={12} />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </section>
  );
};
