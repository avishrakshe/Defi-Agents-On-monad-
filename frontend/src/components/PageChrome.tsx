"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/** Dark "Agent OS" backdrop for inner pages: blueprint grid, colour fields and grain. Place inside a `relative isolate` root. */
export const PageBackdrop: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden noise">
    <div className="absolute inset-0 bg-blueprint opacity-60" />
    <div className="absolute -left-48 top-24 w-[560px] h-[560px] rounded-full bg-[#6d28d9] opacity-25 blur-[140px]" />
    <div className="absolute -right-40 top-[40%] w-[480px] h-[480px] rounded-full bg-[#ccff00] opacity-[0.08] blur-[130px]" />
    <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#ccff00]/[0.04] to-transparent" />
  </div>
);

/** Section eyebrow used in page headers */
export const Eyebrow: React.FC<{ children: React.ReactNode; aside?: React.ReactNode }> = ({ children, aside }) => (
  <div className="flex flex-wrap items-center gap-3 mb-4">
    <span className="stripe-bar" />
    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#ccff00]">{children}</span>
    {aside && <span className="font-mono text-[11px] uppercase tracking-wider text-white/40">{aside}</span>}
  </div>
);

export const SiteFooter: React.FC<{ note?: string }> = ({ note }) => (
  <footer className="relative border-t border-white/10 mt-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-5 text-center md:text-left">
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 clip-chamfer bg-[#ccff00] text-black flex items-center justify-center font-display text-xs">D</span>
        <span className="font-display text-sm text-white">DeFi Agent Marketplace</span>
      </div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-white/40 max-w-xl leading-relaxed">
        {note || "Built for the Monad ecosystem. Not an official Monad Labs product unless otherwise stated."}
      </p>
      <div className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-wider">
        <Link href="/learn" className="text-white/50 hover:text-[#ccff00] transition-colors">
          Academy
        </Link>
        <Link href="/activity" className="text-white/50 hover:text-[#ccff00] transition-colors">
          Activity
        </Link>
        <a
          href="https://testnet.monadvision.com"
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-1 text-white/50 hover:text-[#ccff00] transition-colors"
        >
          MonadVision <ArrowUpRight size={12} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      </div>
    </div>
  </footer>
);
