"use client";

import React, { useRef } from "react";
import { motion, MotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Radar, ShieldCheck, Coins, Star, Zap, LucideIcon } from "lucide-react";
import { Sheet } from "./fx";

type Token = string | { icon: LucideIcon; tone: string };

const TOKENS: Token[] = [
  "Agents", "discover", { icon: Radar, tone: "from-[#836ef9] to-[#5b3ff0]" },
  "verify", { icon: ShieldCheck, tone: "from-[#ccff00] to-[#8be000]" },
  "pay", { icon: Coins, tone: "from-[#f5d90a] to-[#ccff00]" },
  "&", "rate", "each", "other", { icon: Star, tone: "from-[#a594ff] to-[#836ef9]" },
  "—", "onchain,", "inside", "a", "single", "request", { icon: Zap, tone: "from-[#ccff00] to-[#22d3ee]" },
  "on", "Monad."
];

/**
 * Scroll-scrubbed manifesto: each word lights up as the reader scrolls through it.
 */
export const Manifesto: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 45%"] });

  return (
    <Sheet tone="void" className="py-28 sm:py-40">
      <div aria-hidden="true" className="absolute inset-0 bg-blueprint opacity-60" />
      {/* Corner brackets */}
      <span aria-hidden="true" className="absolute left-[8%] top-20 w-16 h-16 border-l-2 border-t-2 border-[#ccff00] rounded-tl-2xl" />
      <span aria-hidden="true" className="absolute right-[8%] bottom-20 w-16 h-16 border-r-2 border-b-2 border-[#ccff00] rounded-br-2xl" />

      <div ref={ref} className="relative max-w-5xl mx-auto px-4 sm:px-8 text-center">
        <p className="font-mono uppercase font-bold leading-[1.25] text-[clamp(1.6rem,4.6vw,3.6rem)] tracking-tight">
          {TOKENS.map((tok, i) => {
            const start = i / TOKENS.length;
            const end = start + 1 / TOKENS.length;
            return typeof tok === "string" ? (
              <Word key={i} progress={scrollYProgress} range={[start, end]} reduce={!!reduce}>
                {tok}
              </Word>
            ) : (
              <IconChip key={i} progress={scrollYProgress} range={[start, end]} reduce={!!reduce} icon={tok.icon} tone={tok.tone} />
            );
          })}
        </p>
      </div>
    </Sheet>
  );
};

const Word: React.FC<{
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
  reduce: boolean;
}> = ({ children, progress, range, reduce }) => {
  const opacity = useTransform(progress, range, [0.14, 1]);
  return (
    <motion.span style={reduce ? undefined : { opacity }} className="inline-block mx-[0.18em] text-white">
      {children}
    </motion.span>
  );
};

const IconChip: React.FC<{
  progress: MotionValue<number>;
  range: [number, number];
  reduce: boolean;
  icon: LucideIcon;
  tone: string;
}> = ({ progress, range, reduce, icon: Icon, tone }) => {
  const scale = useTransform(progress, range, [0.4, 1]);
  const rotate = useTransform(progress, range, [-30, 0]);
  const opacity = useTransform(progress, range, [0.2, 1]);
  return (
    <motion.span
      style={reduce ? undefined : { scale, rotate, opacity }}
      className={`inline-flex align-middle mx-[0.15em] w-[1.15em] h-[1.15em] rounded-[0.3em] bg-gradient-to-br ${tone} text-black items-center justify-center shadow-[0_8px_30px_-6px_rgba(131,110,249,0.6)]`}
    >
      <Icon className="w-[0.62em] h-[0.62em]" strokeWidth={2.4} />
    </motion.span>
  );
};
