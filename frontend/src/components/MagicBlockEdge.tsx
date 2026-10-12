"use client";

import React from "react";
import { Sheet, SectionLabel, SplitHeading, CountUp, Reveal } from "./fx";
import { useMagicblockMetrics, solExplorer } from "../lib/magicblock";

interface Metric {
  to: number | null;
  decimals?: number;
  prefix?: string;
  unit: string;
  label: string;
  note: string;
  fn: string;
}

/** "Why MagicBlock" — every figure is read live from /api/magicblock/metrics; nothing is a target or a constant */
export const MagicBlockEdge: React.FC = () => {
  const m = useMagicblockMetrics();
  const METRICS: Metric[] = [
    { to: m?.erConfirm.medianMs ?? null, unit: "ms", label: "Median ER payment confirm", note: "send → confirmed for pay_for_call, measured by the backend.", fn: "1" },
    { to: m?.callsPerCommit ?? null, decimals: 1, unit: "calls", label: "Per base-layer commit", note: "Paid calls folded into each checkpoint commit to Solana.", fn: "2" },
    { to: m ? m.totalPaidOutUnits / 1e6 : null, prefix: "$", decimals: 3, unit: "tUSDC", label: "Paid out to agents", note: "Moved from the vault to agent payees by Magic Actions.", fn: "3" },
    { to: m?.feePerErTxLamports ?? null, unit: "lamports", label: "Fee per ER transaction", note: "Read from the last ER payment's transaction meta.", fn: "4" }
  ];
  return (
    <Sheet tone="void" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-7">
            <SectionLabel index="05">Why MagicBlock</SectionLabel>
            <SplitHeading
              lines={["Pay per call,", { text: "settle in batches.", className: "italic text-violet" }]}
              className="mt-6 font-display text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.92] tracking-[-0.02em]"
            />
          </div>
          <Reveal delay={0.15} className="lg:col-span-5">
            <p className="text-[17px] leading-relaxed text-ink-2 border-l-[1.5px] border-ink pl-5">
              Each agent call is paid, receipted and reputation-scored in one Ephemeral Rollup transaction. Real tokens move
              only at checkpoints, when a Magic Action pays every agent what it earned since the last commit.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 border-y-[1.5px] border-ink">
          {METRICS.map((x, i) => (
            <Reveal key={x.label} delay={i * 0.07} className={`py-8 px-5 ${i > 0 ? "lg:border-l border-ink/20" : ""} ${i % 2 === 1 ? "sm:border-l border-ink/20" : ""} ${i >= 2 ? "border-t sm:border-t lg:border-t-0 border-ink/20" : ""} ${i === 1 ? "border-t sm:border-t-0" : ""}`}>
              <div className="flex items-baseline gap-2">
                {x.to === null ? (
                  <span className="font-display text-[3.6rem] leading-none">—</span>
                ) : (
                  <CountUp to={x.to} prefix={x.prefix} decimals={x.decimals} className="font-display text-[3.6rem] leading-none" />
                )}
                <span className="font-mono text-[12px] text-ink-2">{x.unit}</span>
                <sup className="font-mono text-[10px] text-flame">{x.fn}</sup>
              </div>
              <div className="mt-4 text-[15px] font-semibold">{x.label}</div>
              <p className="mt-1 text-[13.5px] text-ink-2 leading-relaxed">{x.note}</p>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 font-mono text-[10.5px] text-ink-3 leading-relaxed">
          ¹ Median of the last {m?.erConfirm.n ?? 0} ER payments this backend instance submitted ({m ? m.erRpc.replace("https://", "") : "—"}). ² Ledger
          total_calls ÷ checkpoints on the ER. ³ Σ AgentPayout.paid_total on Solana devnet (tUSDC is this market&apos;s 6-decimal test mint). ⁴ From
          transaction meta.{" "}
          {m?.lastCommit && (
            <>
              Last commit{" "}
              <a className="underline" href={m.lastCommit.explorerUrl} target="_blank" rel="noreferrer">
                {m.lastCommit.signature.slice(0, 8)}…
              </a>
              .{" "}
            </>
          )}
          Program{" "}
          {m && (
            <a className="underline" href={solExplorer(m.programId, "address")} target="_blank" rel="noreferrer">
              {m.programId.slice(0, 8)}…
            </a>
          )}
        </p>
      </div>
    </Sheet>
  );
};
