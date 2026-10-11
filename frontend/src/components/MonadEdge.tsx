"use client";

import React from "react";
import { Sheet, SectionLabel, SplitHeading, CountUp, Reveal } from "./fx";

const METRICS = [
  { to: 10000, unit: "TPS", label: "Throughput target", note: "Dense agent-to-agent traffic without queueing.", fn: "1" },
  { to: 0.3, decimals: 1, prefix: "~", unit: "sec", label: "Block time", note: "Measured live by the gas agent on every run.", fn: "2" },
  { to: 0.001, prefix: "$", decimals: 3, unit: "USDC", label: "Per agent call", note: "Sub-cent pricing that is actually worth settling.", fn: "3" },
  { to: 100, unit: "%", label: "EVM compatible", note: "Solidity, ethers, Hardhat — no new toolchain.", fn: "4" }
];

export const MonadEdge: React.FC = () => (
  <Sheet tone="void" className="py-20 sm:py-28">
    <div className="max-w-7xl mx-auto px-4 sm:px-8">
      <div className="grid lg:grid-cols-12 gap-8 items-end">
        <div className="lg:col-span-7">
          <SectionLabel index="05">Why Monad</SectionLabel>
          <SplitHeading
            lines={["Built for", { text: "machine speed.", className: "italic text-violet" }]}
            className="mt-6 font-display text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.92] tracking-[-0.02em]"
          />
        </div>
        <Reveal delay={0.15} className="lg:col-span-5">
          <p className="text-[17px] leading-relaxed text-ink-2 border-l-[1.5px] border-ink pl-5">
            Payments, tokenization and agents at speed. This marketplace needs all three at once — and settlement fast
            enough to happen inside a single HTTP request.
          </p>
        </Reveal>
      </div>

      <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 border-y-[1.5px] border-ink">
        {METRICS.map((m, i) => (
          <Reveal key={m.label} delay={i * 0.07} className={`py-8 px-5 ${i > 0 ? "lg:border-l border-ink/20" : ""} ${i % 2 === 1 ? "sm:border-l border-ink/20" : ""} ${i >= 2 ? "border-t sm:border-t lg:border-t-0 border-ink/20" : ""} ${i === 1 ? "border-t sm:border-t-0" : ""}`}>
            <div className="flex items-baseline gap-2">
              <CountUp to={m.to} prefix={m.prefix} decimals={m.decimals} className="font-display text-[3.6rem] leading-none" />
              <span className="font-mono text-[12px] text-ink-2">{m.unit}</span>
              <sup className="font-mono text-[10px] text-flame">{m.fn}</sup>
            </div>
            <div className="mt-4 text-[15px] font-semibold">{m.label}</div>
            <p className="mt-1 text-[13.5px] text-ink-2 leading-relaxed">{m.note}</p>
          </Reveal>
        ))}
      </div>
      <p className="mt-4 font-mono text-[10.5px] text-ink-3">
        ¹ Monad design target. ² Average over the last 200 blocks, measured by the Gas Oracle. ³ x402 price per specialist call. ⁴ Standard EVM bytecode.
      </p>
    </div>
  </Sheet>
);
