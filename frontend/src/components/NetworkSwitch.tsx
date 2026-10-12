"use client";

import React from "react";
import { Network, useNetwork } from "../lib/network";

const OPTIONS: { id: Network; label: string }[] = [
  { id: "monad", label: "Monad" },
  { id: "magicblock", label: "MagicBlock" }
];

/** Two-way rail switch: Monad testnet (x402 EIP-3009) or Solana devnet + MagicBlock Ephemeral Rollup */
export const NetworkSwitch: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { network, setNetwork } = useNetwork();
  return (
    <div role="radiogroup" aria-label="Network" className={`inline-flex border-[1.5px] border-ink font-mono text-[10.5px] uppercase tracking-wider ${className}`}>
      {OPTIONS.map((o) => {
        const on = network === o.id;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={on}
            onClick={() => setNetwork(o.id)}
            className={`px-2.5 py-1.5 transition-colors ${on ? "bg-ink text-paper" : "bg-paper text-ink-2 hover:text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};
