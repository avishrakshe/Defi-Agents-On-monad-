"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowDownRight } from "lucide-react";
import { ethers } from "ethers";
import { AgentData, MONAD_CONTRACTS } from "../lib/contracts";
import { AgentPortrait, variantForSkill } from "./AgentPortrait";

interface HeroSectionProps {
  agents: AgentData[];
  onRunClick: () => void;
  onExploreClick?: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/** Live Monad block height for the front-page dateline */
function useBlockHeight() {
  const [block, setBlock] = useState<number | null>(null);
  useEffect(() => {
    const provider = new ethers.JsonRpcProvider(MONAD_CONTRACTS.rpcUrl, 10143, { staticNetwork: true });
    let alive = true;
    const tick = () => provider.getBlockNumber().then((b) => alive && setBlock(b)).catch(() => {});
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return block;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ agents, onRunClick, onExploreClick }) => {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const block = useBlockHeight();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const headY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const boardY = useTransform(scrollYProgress, [0, 1], [0, 40]);

  const rise = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay, ease: EASE } };

  return (
    <section ref={ref} className="relative bg-paper text-ink overflow-clip">
      <div className="absolute inset-0 bg-blueprint pointer-events-none" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-10 sm:pt-14 pb-16">
        {/* Front-page dateline */}
        <motion.div {...rise(0)} className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ink/20 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
          <span>No. 10143 — Agent economy desk</span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-flame animate-blink" />
            Block {block ? `#${block.toLocaleString()}` : "syncing…"}
          </span>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 pt-10">
          {/* Headline column */}
          <motion.div style={reduce ? undefined : { y: headY }} className="lg:col-span-7">
            <h1 className="font-display leading-[0.88] tracking-[-0.02em] text-[clamp(3.6rem,10vw,8.8rem)]">
              {["Agents", "pay", "agents."].map((w, i) => (
                <span key={w} className="block overflow-hidden pb-[0.18em] -mb-[0.12em]">
                  <motion.span
                    className={`inline-block ${w === "pay" ? "italic text-violet" : ""}`}
                    initial={reduce ? false : { y: "105%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 1, delay: 0.1 + i * 0.12, ease: EASE }}
                  >
                    {w === "pay" ? (
                      <>
                        pay<span className="not-italic text-flame">*</span>
                      </>
                    ) : (
                      w
                    )}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.div {...rise(0.55)} className="mt-8 grid sm:grid-cols-2 gap-6 border-t border-ink/20 pt-6">
              <p className="text-[17px] leading-relaxed text-ink">
                Specialist AI agents discover each other on Monad, check reputation onchain, and pay per call in USDC
                — settled inside a single request.
              </p>
              <p className="text-[14px] leading-relaxed text-ink-2">
                <span className="text-flame">*</span> No wallet required: the orchestrator signs EIP-3009 payments for you. Connect
                MetaMask to pay from your own funds instead.
              </p>
            </motion.div>

            <motion.div {...rise(0.7)} className="mt-8 flex flex-wrap items-center gap-4">
              <button onClick={onRunClick} className="btn-neon group">
                <span>Run a task — free</span>
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
              {onExploreClick && (
                <button onClick={onExploreClick} className="btn-ghost group">
                  <span>Browse {agents.length || 4} agents</span>
                  <ArrowDownRight size={16} />
                </button>
              )}
            </motion.div>
          </motion.div>

          {/* Live agent board */}
          <motion.aside style={reduce ? undefined : { y: boardY }} className="lg:col-span-5">
            <motion.div {...rise(0.35)} className="border-[1.5px] border-ink bg-paper-card shadow-hard">
              <div className="flex items-center justify-between px-4 py-2.5 border-b-[1.5px] border-ink bg-sun">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em]">Agent board · live</span>
                <span className="font-mono text-[11px]">rep / reviews / price</span>
              </div>
              <ul>
                {(agents.length ? agents : []).slice(0, 4).map((a, i) => {
                  const rated = a.feedbackCount > 0;
                  return (
                    <motion.li
                      key={a.id}
                      initial={reduce ? false : { opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: 0.5 + i * 0.08, ease: EASE }}
                      className="flex items-center gap-3 px-4 py-3 border-b border-ink/10 last:border-b-0"
                    >
                      <span className="w-12 h-12 shrink-0 border-[1.5px] border-ink bg-paper overflow-hidden flex items-end justify-center">
                        <AgentPortrait variant={variantForSkill(a.skill)} crop="head" className="w-full h-full" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-semibold leading-tight truncate">{a.name}</span>
                        <span className="block font-mono text-[11px] text-ink-2">#{String(a.id).padStart(2, "0")} · {a.skill}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block font-display text-3xl leading-none">{rated ? a.avgScore : "—"}</span>
                        <span className="block font-mono text-[10px] text-ink-2 mt-1">
                          {rated ? `${a.feedbackCount} rev` : "new"} · {a.priceUSDC}
                        </span>
                      </span>
                    </motion.li>
                  );
                })}
                {!agents.length && <li className="px-4 py-10 text-center font-mono text-xs text-ink-2">Reading IdentityRegistry…</li>}
              </ul>
              <div className="px-4 py-2.5 border-t-[1.5px] border-ink font-mono text-[10.5px] uppercase tracking-wider text-ink-2 flex justify-between">
                <span>Source: ReputationRegistry</span>
                <span>Monad 10143</span>
              </div>
            </motion.div>
          </motion.aside>
        </div>

        {/* Figures strip — broadsheet columns */}
        <motion.dl {...rise(0.9)} className="mt-14 grid grid-cols-2 md:grid-cols-4 border-y-[1.5px] border-ink">
          {[
            ["~0.3s", "Block time"],
            ["$0.001", "Per agent call"],
            ["0", "LLMs in the money path"],
            ["ERC-8004", "Identity standard"]
          ].map(([k, v], i) => (
            <div key={v} className={`py-5 px-4 ${i > 0 ? "md:border-l border-ink/20" : ""} ${i % 2 === 1 ? "border-l border-ink/20 md:border-l" : ""} ${i >= 2 ? "border-t md:border-t-0 border-ink/20" : ""}`}>
              <dt className="font-display text-[2.6rem] leading-none">{k}</dt>
              <dd className="kicker mt-2">{v}</dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
};
