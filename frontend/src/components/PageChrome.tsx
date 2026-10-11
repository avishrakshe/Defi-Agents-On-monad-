"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/** Paper backdrop for inner pages: faint ledger columns. Place inside a `relative isolate` root. */
export const PageBackdrop: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <div className="absolute inset-0 bg-blueprint" />
  </div>
);

/** Section eyebrow used in page headers */
export const Eyebrow: React.FC<{ children: React.ReactNode; aside?: React.ReactNode }> = ({ children, aside }) => (
  <div className="flex flex-wrap items-center gap-3 mb-4">
    <span className="font-display italic text-2xl leading-none text-flame">§</span>
    <span className="kicker text-ink">{children}</span>
    {aside && <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{aside}</span>}
  </div>
);

export const SiteFooter: React.FC<{ note?: string }> = ({ note }) => (
  <footer className="relative border-t-[1.5px] border-ink mt-16 bg-paper">
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 grid gap-6 md:grid-cols-3 items-start">
      <div>
        <div className="font-display text-2xl">DeFi Agents</div>
        <p className="mt-1 text-[13px] text-ink-2">An agent-to-agent marketplace on Monad Testnet.</p>
      </div>
      <p className="font-mono text-[11px] text-ink-2 leading-relaxed">
        {note || "Built for the Monad ecosystem. Not an official Monad Labs product unless otherwise stated."}
      </p>
      <div className="flex md:justify-end gap-5 font-mono text-[12px] uppercase tracking-wider">
        <Link href="/learn" className="link-ink">
          Academy
        </Link>
        <Link href="/activity" className="link-ink">
          Activity
        </Link>
        <a href="https://testnet.monadvision.com" target="_blank" rel="noreferrer" className="link-ink">
          MonadVision <ArrowUpRight size={12} />
        </a>
      </div>
    </div>
  </footer>
);
