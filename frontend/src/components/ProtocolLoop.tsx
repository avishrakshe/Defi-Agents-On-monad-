"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { Sheet, SectionLabel } from "./fx";

interface Step {
  n: string;
  title: string;
  body: string;
  code: string;
  tint: string;
}

const STEPS: Step[] = [
  { n: "1", title: "Decompose", body: "Your plain-language request is split into specialist subtasks by deterministic rules. No LLM decides where money goes.", code: "POST /api/decompose", tint: "bg-sun-soft" },
  { n: "2", title: "Verify", body: "Each agent's identity and live reputation are read from the ERC-8004 registries before anything is paid.", code: "IdentityRegistry.getAllAgents()", tint: "bg-violet-soft" },
  { n: "3", title: "Quote", body: "The specialist answers HTTP 402 Payment Required with its price — a tenth of a cent in USDC.", code: "402 → maxAmountRequired: 1000", tint: "bg-flame-soft" },
  { n: "4", title: "Settle", body: "An EIP-3009 authorization is signed and settled on Monad in under a second; the request is retried and served.", code: "USDC.transferWithAuthorization()", tint: "bg-moss-soft" },
  { n: "5", title: "Rate", body: "A service-quality score is written to the ReputationRegistry, so trust compounds with every paid call.", code: "submitFeedbackFor(agentId, score)", tint: "bg-paper-shade" }
];

/** Pinned horizontal track: vertical scroll turns the pages of the protocol. */
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
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
      <div ref={containerRef} className="relative" style={{ height: `calc(100vh + ${distance}px)` }}>
        <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
          <motion.div
            ref={trackRef}
            style={{ x }}
            className="relative flex items-stretch gap-6 pl-4 sm:pl-8 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))] pr-[10vw] will-change-transform"
          >
            <div className="shrink-0 w-[82vw] sm:w-[440px] flex flex-col justify-center pr-6">
              <LoopIntro />
            </div>
            {STEPS.map((s) => (
              <div key={s.n} className="shrink-0 w-[78vw] sm:w-[360px]">
                <StepCard step={s} />
              </div>
            ))}
          </motion.div>

          <div className="relative max-w-7xl w-full mx-auto px-4 sm:px-8 mt-10">
            <div className="h-[3px] bg-ink/10 relative overflow-hidden">
              <motion.div style={{ width: bar }} className="absolute inset-y-0 left-0 bg-flame" />
            </div>
            <div className="mt-3 flex justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
              <span>Request in</span>
              <span>Answer out — one block cycle</span>
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
};

const LoopIntro: React.FC = () => (
  <div>
    <SectionLabel index="02">How a call works</SectionLabel>
    <h2 className="mt-6 font-display text-[clamp(2.8rem,6vw,4.8rem)] leading-[0.92] tracking-[-0.02em]">
      Five steps,
      <br />
      <span className="italic text-violet">one request.</span>
    </h2>
    <p className="mt-5 text-[16px] leading-relaxed text-ink-2 max-w-sm">
      This is the x402 loop every task runs through. Keep scrolling to turn the pages.
    </p>
  </div>
);

const StepCard: React.FC<{ step: Step }> = ({ step }) => (
  <article className="group h-full min-h-[420px] flex flex-col border-[1.5px] border-ink bg-paper-card transition-shadow duration-200 hover:shadow-hard">
    <div className={`relative h-40 border-b-[1.5px] border-ink ${step.tint} overflow-hidden`}>
      <span className="absolute -bottom-6 left-4 font-display text-[11rem] leading-none text-ink transition-transform duration-500 group-hover:-translate-y-2">
        {step.n}
      </span>
      <span className="absolute top-3 right-3 font-mono text-[11px] uppercase tracking-[0.16em]">Step {step.n} / 5</span>
    </div>
    <div className="p-6 flex flex-col flex-1">
      <h3 className="font-display text-[2.2rem] leading-none">{step.title}</h3>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{step.body}</p>
      <code className="mt-auto pt-6 font-mono text-[12px] text-ink">
        <span className="text-flame">→ </span>
        {step.code}
      </code>
    </div>
  </article>
);
