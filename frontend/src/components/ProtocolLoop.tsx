"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { Workflow, ShieldCheck, Receipt, PenLine, Star, LucideIcon } from "lucide-react";
import { Sheet, SectionLabel } from "./fx";

interface Step {
  n: string;
  title: string;
  body: string;
  code: string;
  icon: LucideIcon;
}

const STEPS: Step[] = [
  {
    n: "01",
    title: "Decompose",
    body: "Your natural-language task is split deterministically into specialist subtasks. Zero LLM in the execution path.",
    code: "POST /api/decompose",
    icon: Workflow
  },
  {
    n: "02",
    title: "Verify",
    body: "ERC-8004 registries check identity, live reputation and staked collateral before a single cent moves.",
    code: "[reputation_ok]",
    icon: ShieldCheck
  },
  {
    n: "03",
    title: "402 Quote",
    body: "The specialist answers HTTP 402 Payment Required with an x402 price — a fraction of a cent in tUSDC.",
    code: "402 → $0.001 tUSDC",
    icon: Receipt
  },
  {
    n: "04",
    title: "Sign & Settle",
    body: "An EIP-712 / EIP-3009 authorization is signed and settled on Monad in ~600ms. The request is retried and served.",
    code: "transferWithAuthorization()",
    icon: PenLine
  },
  {
    n: "05",
    title: "Rate",
    body: "A post-execution score is written to the ReputationRegistry, so trust compounds onchain with every call.",
    code: "giveFeedback(score)",
    icon: Star
  }
];

/**
 * Pinned horizontal track: vertical scroll drives the protocol steps sideways.
 */
export const ProtocolLoop: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [reduce, setReduce] = useState(false);
  const [distance, setDistance] = useState(0);

  // Read after mount so server and client render the same tree
  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const measure = () => {
      if (!trackRef.current) return;
      setDistance(Math.max(0, trackRef.current.scrollWidth - window.innerWidth));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  const x = useTransform(smooth, (v) => -v * distance);
  const bar = useTransform(smooth, [0, 1], ["0%", "100%"]);

  if (reduce) {
    return (
      <Sheet id="protocol" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <LoopIntro />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <StepCard key={s.n} step={s} />
            ))}
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet id="protocol">
      {/* Height determines how long the section stays pinned */}
      <div ref={containerRef} className="relative" style={{ height: `calc(100vh + ${distance}px)` }}>
        <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-blueprint" />
          <div aria-hidden="true" className="absolute right-0 bottom-0 w-[600px] h-[400px] bg-[#ccff00] opacity-[0.08] blur-[120px]" />

          <motion.div ref={trackRef} style={{ x }} className="relative flex items-stretch gap-5 sm:gap-6 pl-4 sm:pl-8 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))] pr-[10vw] will-change-transform">
            <div className="shrink-0 w-[82vw] sm:w-[460px] flex flex-col justify-center pr-6">
              <LoopIntro />
            </div>
            {STEPS.map((s) => (
              <div key={s.n} className="shrink-0 w-[78vw] sm:w-[380px]">
                <StepCard step={s} />
              </div>
            ))}
          </motion.div>

          {/* Progress rail */}
          <div className="relative max-w-7xl w-full mx-auto px-4 sm:px-8 mt-12">
            <div className="h-px bg-white/10 relative overflow-hidden">
              <motion.div style={{ width: bar }} className="absolute inset-y-0 left-0 bg-[#ccff00] shadow-[0_0_10px_#ccff00]" />
            </div>
            <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              <span>Request in</span>
              <span>Answer out · ~1 block cycle</span>
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
};

const LoopIntro: React.FC = () => (
  <div>
    <SectionLabel index="001">How it works</SectionLabel>
    <h2 className="mt-8 font-display uppercase text-[clamp(2.6rem,6vw,4.75rem)] leading-[0.95]">
      The <span className="text-[#ccff00]">x402</span>
      <br />
      loop
    </h2>
    <p className="mt-6 font-mono text-sm uppercase leading-relaxed text-white/50 max-w-sm">
      Discover → verify → pay → rate. Five onchain steps, one request cycle, no human in the loop.
    </p>
  </div>
);

const StepCard: React.FC<{ step: Step }> = ({ step }) => {
  const Icon = step.icon;
  return (
    <div className="group h-full clip-chamfer-lg bg-gradient-to-b from-white/[0.14] to-white/[0.03] p-px">
      <div className="clip-chamfer-lg h-full bg-[#121213] p-7 sm:p-8 flex flex-col min-h-[400px] relative overflow-hidden">
        <span className="absolute right-6 top-5 font-display text-[6.5rem] leading-none text-outline opacity-40 select-none">
          {step.n}
        </span>
        <div className="relative w-20 h-20 clip-chamfer bg-gradient-to-br from-[#ccff00] to-[#9be000] flex items-center justify-center text-black shadow-glow transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105">
          <Icon size={34} strokeWidth={2} />
        </div>
        <h3 className="relative mt-auto pt-16 font-display uppercase text-3xl text-white">{step.title}</h3>
        <p className="relative mt-4 font-mono text-[13px] uppercase leading-relaxed text-white/55">{step.body}</p>
        <code className="relative mt-6 inline-block self-start font-mono text-[11px] text-[#ccff00] border border-[#ccff00]/30 bg-[#ccff00]/[0.06] px-2.5 py-1 rounded">
          {step.code}
        </code>
      </div>
    </div>
  );
};
