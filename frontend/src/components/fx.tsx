"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, useScroll, useTransform, animate } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/* Sheet — a printed section: paper band whose top rule draws in        */
/* ------------------------------------------------------------------ */

interface SheetProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
  tone?: "sheet" | "void" | "raised" | "violet" | "flame";
}

const TONES = {
  sheet: "bg-paper",
  void: "bg-paper-shade",
  raised: "bg-paper-card",
  violet: "bg-violet text-paper",
  flame: "bg-flame"
};

export const Sheet: React.FC<SheetProps> = ({ id, children, className = "", tone = "sheet" }) => {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 40%"] });
  const ruleScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section ref={ref} id={id} className={`relative overflow-clip text-ink ${TONES[tone]} ${className}`}>
      <motion.div
        aria-hidden="true"
        style={reduce ? undefined : { scaleX: ruleScale }}
        className="absolute top-0 left-0 right-0 h-[1.5px] bg-ink origin-left z-10"
      />
      {children}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* SectionLabel — "§ 01 — Label" broadsheet section header            */
/* ------------------------------------------------------------------ */

export const SectionLabel: React.FC<{ children: React.ReactNode; index?: string }> = ({ children, index }) => (
  <Reveal className="flex items-center gap-3">
    <span className="font-display italic text-2xl leading-none text-flame">§</span>
    {index && <span className="font-mono text-xs text-ink-2">{index.replace(/^0+(?=\d{2})/, "")}</span>}
    <span className="h-px w-10 bg-ink/40" />
    <span className="kicker text-ink">{children}</span>
  </Reveal>
);

/* ------------------------------------------------------------------ */
/* Reveal — fade/slide up once when scrolled into view                */
/* ------------------------------------------------------------------ */

export const Reveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}> = ({ children, className = "", delay = 0, y = 24 }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* SplitHeading — words rise out of a mask, staggered                 */
/* ------------------------------------------------------------------ */

export const SplitHeading: React.FC<{
  lines: (string | { text: string; className?: string })[];
  className?: string;
  as?: "h1" | "h2" | "h3";
}> = ({ lines, className = "", as = "h2" }) => {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  let wordIndex = 0;

  return (
    <Tag className={className} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }}>
      {lines.map((line, li) => {
        const { text, className: lineClass = "" } = typeof line === "string" ? { text: line } : line;
        const words = text.split(" ");
        return (
          <span key={li} className={`block ${lineClass}`}>
            {words.map((word, wi) => {
              const i = wordIndex++;
              return (
                <span key={wi} className="inline-block overflow-hidden align-bottom pb-[0.18em] -mb-[0.18em]">
                  <motion.span
                    className="inline-block"
                    variants={{
                      hidden: reduce ? { y: 0 } : { y: "110%" },
                      show: { y: 0, transition: { duration: 0.85, delay: i * 0.05, ease: EASE } }
                    }}
                  >
                    {word}
                    {wi < words.length - 1 ? " " : ""}
                  </motion.span>
                </span>
              );
            })}
          </span>
        );
      })}
    </Tag>
  );
};

/* ------------------------------------------------------------------ */
/* CountUp — animates a number when it enters the viewport            */
/* ------------------------------------------------------------------ */

export const CountUp: React.FC<{
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}> = ({ to, decimals = 0, prefix = "", suffix = "", duration = 1.6, className = "" }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration, ease: EASE, onUpdate: (v) => setValue(v) });
    return () => controls.stop();
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Marquee — ticker tape                                               */
/* ------------------------------------------------------------------ */

export const Marquee: React.FC<{ items: string[]; className?: string; reverse?: boolean; separator?: string }> = ({
  items,
  className = "",
  reverse = false,
  separator = "■"
}) => (
  <div className={`relative overflow-hidden whitespace-nowrap ${className}`}>
    <div className="inline-flex animate-marquee" style={reverse ? { animationDirection: "reverse" } : undefined}>
      {[0, 1].map((dup) => (
        <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
          {items.map((item, i) => (
            <span key={i} className="flex items-center">
              <span className="px-5">{item}</span>
              <span className="text-[0.55em] opacity-70">{separator}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* TiltCard — lifts and prints a hard shadow on hover                  */
/* ------------------------------------------------------------------ */

export const TiltCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`group relative transition-transform duration-200 hover:-translate-x-1 hover:-translate-y-1 ${className}`}>{children}</div>
);
