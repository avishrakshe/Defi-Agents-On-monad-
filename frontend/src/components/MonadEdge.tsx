"use client";

import React from "react";
import { Sheet, SectionLabel, SplitHeading, CountUp, Reveal } from "./fx";

const METRICS = [
  { to: 10000, suffix: "", unit: "TPS", label: "Throughput target", note: "Dense agent-to-agent traffic without congestion." },
  { to: 300, suffix: "", unit: "MS", label: "Block time", note: "Settlement inline with the request, not batched later." },
  { to: 600, prefix: "~", suffix: "", unit: "MS", label: "Finality", note: "Fast enough for synchronous machine commerce." },
  { to: 0.001, prefix: "$", decimals: 3, unit: "USDC", label: "Per agent call", note: "Sub-cent micropayments that are actually viable." }
];

export const MonadEdge: React.FC = () => (
  <Sheet tone="raised" className="py-24 sm:py-32">
    <div aria-hidden="true" className="absolute inset-0 bg-blueprint" />
    <div aria-hidden="true" className="absolute -left-40 top-1/4 w-[560px] h-[560px] rounded-full bg-[#6d28d9] opacity-40 blur-[140px]" />
    <div aria-hidden="true" className="absolute -right-24 -bottom-24 w-[460px] h-[460px] rounded-full bg-[#ccff00] opacity-20 blur-[130px]" />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-8">
      <SectionLabel index="004">Why Monad</SectionLabel>

      <div className="mt-10 grid lg:grid-cols-12 gap-8 items-end">
        <SplitHeading
          lines={["Built for", { text: "machine speed", className: "text-[#ccff00]" }]}
          className="lg:col-span-7 font-display uppercase text-[clamp(2.6rem,6.5vw,5.5rem)] leading-[0.95]"
        />
        <Reveal className="lg:col-span-5" delay={0.2}>
          <p className="font-mono text-sm uppercase leading-relaxed text-white/55">
            Payments, tokenization and agents at speed — this marketplace needs all three at once. Full EVM
            compatibility, MON for gas, USDC for value.
          </p>
        </Reveal>
      </div>

      <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map((m, i) => (
          <Reveal key={m.label} delay={i * 0.08}>
            <div className="group h-full clip-chamfer bg-white/[0.08] p-px transition-colors hover:bg-[#ccff00]/60">
              <div className="clip-chamfer h-full bg-[#141415]/95 backdrop-blur p-6 sm:p-7">
                <div className="flex items-baseline gap-2">
                  <CountUp
                    to={m.to}
                    prefix={m.prefix}
                    decimals={m.decimals}
                    className="font-display text-4xl sm:text-5xl text-white group-hover:text-[#ccff00] transition-colors"
                  />
                  <span className="font-mono text-xs text-[#ccff00]">{m.unit}</span>
                </div>
                <div className="mt-5 font-display uppercase text-sm tracking-wider text-white/90">{m.label}</div>
                <p className="mt-2 font-mono text-[12px] uppercase leading-relaxed text-white/45">{m.note}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </Sheet>
);
