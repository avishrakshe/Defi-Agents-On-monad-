"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  animate
} from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/* Sheet — a dark rounded panel that rises over the lime frame         */
/* ------------------------------------------------------------------ */

interface SheetProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
  tone?: "sheet" | "void" | "raised";
}

const TONES = {
  sheet: "bg-[#151516]",
  void: "bg-[#0e0e0f]",
  raised: "bg-[#1b1b1d]"
};

export const Sheet: React.FC<SheetProps> = ({ id, children, className = "", tone = "sheet" }) => {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 35%"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  const radius = useTransform(scrollYProgress, [0, 1], [88, 44]);

  return (
    <motion.section
      ref={ref}
      id={id}
      style={reduce ? undefined : { scale, borderTopLeftRadius: radius, borderTopRightRadius: radius }}
      className={`relative overflow-clip rounded-t-sheet -mt-12 first:mt-0 origin-top text-white noise ${TONES[tone]} ${className}`}
    >
      {children}
    </motion.section>
  );
};

/* ------------------------------------------------------------------ */
/* SectionLabel — striped lime marker + uppercase label               */
/* ------------------------------------------------------------------ */

export const SectionLabel: React.FC<{ children: React.ReactNode; index?: string }> = ({ children, index }) => (
  <Reveal className="flex items-center gap-4">
    <span className="stripe-bar" />
    {index && <span className="font-mono text-xs text-[#ccff00]">{index}</span>}
    <span className="font-display text-sm sm:text-base tracking-[0.18em] uppercase text-white">{children}</span>
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
}> = ({ children, className = "", delay = 0, y = 28 }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
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
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
    >
      {lines.map((line, li) => {
        const { text, className: lineClass = "" } = typeof line === "string" ? { text: line } : line;
        return (
          <span key={li} className={`block ${lineClass}`}>
            {text.split(" ").map((word, wi) => {
              const i = wordIndex++;
              return (
                <span key={wi} className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]">
                  <motion.span
                    className="inline-block"
                    variants={{
                      hidden: reduce ? { y: 0 } : { y: "110%" },
                      show: { y: 0, transition: { duration: 0.9, delay: i * 0.06, ease: EASE } }
                    }}
                  >
                    {word}
                    {wi < text.split(" ").length - 1 ? " " : ""}
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
}> = ({ to, decimals = 0, prefix = "", suffix = "", duration = 1.8, className = "" }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (v) => setValue(v)
    });
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
/* Marquee — infinite ticker band                                      */
/* ------------------------------------------------------------------ */

export const Marquee: React.FC<{ items: string[]; className?: string; reverse?: boolean }> = ({
  items,
  className = "",
  reverse = false
}) => (
  <div className={`relative overflow-hidden whitespace-nowrap ${className}`}>
    <div
      className="inline-flex animate-marquee"
      style={reverse ? { animationDirection: "reverse" } : undefined}
    >
      {[0, 1].map((dup) => (
        <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
          {items.map((item, i) => (
            <span key={i} className="flex items-center">
              <span className="px-6">{item}</span>
              <span className="text-[0.6em]">✦</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* TiltCard — 3D tilt toward the cursor with a lime spotlight          */
/* ------------------------------------------------------------------ */

export const TiltCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ""
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [7, -7]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(px, [0, 1], [-9, 9]), { stiffness: 200, damping: 20 });
  const glow = useTransform(
    [px, py],
    ([x, y]: number[]) =>
      `radial-gradient(420px circle at ${x * 100}% ${y * 100}%, rgba(204,255,0,0.14), transparent 45%)`
  );

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={`relative group ${className}`}
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: glow }}
      />
      {children}
    </motion.div>
  );
};
