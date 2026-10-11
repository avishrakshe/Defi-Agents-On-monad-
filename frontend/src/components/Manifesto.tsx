"use client";

import React, { useRef } from "react";
import { motion, MotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Sheet } from "./fx";

type Token = { w: string; mark?: "violet" | "flame" | "sun"; italic?: boolean };

const TOKENS: Token[] = [
  { w: "Agents" },
  { w: "discover," , mark: "sun" },
  { w: "verify," , mark: "violet" },
  { w: "pay" , mark: "flame" },
  { w: "and" },
  { w: "rate" , italic: true },
  { w: "each" },
  { w: "other" },
  { w: "—" },
  { w: "onchain," , italic: true },
  { w: "inside" },
  { w: "one" },
  { w: "request," },
  { w: "on" },
  { w: "Monad." , italic: true }
];

const MARK: Record<NonNullable<Token["mark"]>, string> = {
  violet: "bg-violet-soft",
  flame: "bg-flame-soft",
  sun: "bg-sun-soft"
};

/** Scroll-scrubbed pull quote: each word inks in as the reader scrolls past it. */
export const Manifesto: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 50%"] });

  return (
    <Sheet tone="void" className="py-24 sm:py-36">
      <div ref={ref} className="relative max-w-6xl mx-auto px-4 sm:px-8">
        <span aria-hidden="true" className="absolute -top-10 left-2 sm:left-6 font-display text-[9rem] leading-none text-flame select-none">
          “
        </span>
        <p className="relative font-display leading-[1.05] tracking-[-0.015em] text-[clamp(2.3rem,6vw,5.2rem)]">
          {TOKENS.map((tok, i) => (
            <Word key={i} tok={tok} progress={scrollYProgress} range={[i / TOKENS.length, (i + 1) / TOKENS.length]} reduce={!!reduce} />
          ))}
        </p>
        <div className="mt-10 flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
          <span className="h-px w-12 bg-ink" />
          The thesis, in one sentence
        </div>
      </div>
    </Sheet>
  );
};

const Word: React.FC<{ tok: Token; progress: MotionValue<number>; range: [number, number]; reduce: boolean }> = ({ tok, progress, range, reduce }) => {
  const color = useTransform(progress, range, ["rgba(22,19,15,0.16)", "rgba(22,19,15,1)"]);
  const markScale = useTransform(progress, range, [0, 1]);
  return (
    <span className="relative inline-block mr-[0.22em]">
      {tok.mark && (
        <motion.span
          aria-hidden="true"
          style={reduce ? undefined : { scaleX: markScale }}
          className={`absolute left-0 right-0 bottom-[0.12em] h-[0.42em] origin-left -z-0 ${MARK[tok.mark]}`}
        />
      )}
      <motion.span style={reduce ? undefined : { color }} className={`relative ${tok.italic ? "italic" : ""}`}>
        {tok.w}
      </motion.span>
    </span>
  );
};
