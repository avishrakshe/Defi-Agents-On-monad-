"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { AgentPortrait, variantForSkill } from "./AgentPortrait";
import { submitClientFeedback } from "../lib/wallet";
import { MONAD_CONTRACTS } from "../lib/contracts";
import { useActivityStore } from "../lib/activity-store";

export interface AgentRun {
  agentId: number;
  agentName: string;
  skill: string;
  result: any;
  durationMs?: number;
  /** Present when the call was paid and recorded in ReputationRegistryV2 */
  review?: {
    mode: "A" | "B";
    callId: string;
    /** Mode A: the operator review written automatically */
    operatorScore?: number;
    operatorTx?: string;
  };
}

/** 1–5 stars → 0–100 */
const starsToScore = (stars: number) => stars * 20;

const ReviewBar: React.FC<{ run: AgentRun }> = ({ run }) => {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [state, setState] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const r = run.review!;

  if (r.mode === "A") {
    return (
      <div className="px-4 py-2.5 border-t border-ink/20 font-mono text-[11px] text-ink-2 flex flex-wrap items-center justify-between gap-2">
        <span>Operator review {r.operatorScore !== undefined ? `${r.operatorScore}/100` : "not recorded"} · not independent</span>
        {r.operatorTx && (
          <a href={`${EXPLORER}/tx/${r.operatorTx}`} target="_blank" rel="noreferrer" className="text-violet hover:underline">
            {short(r.operatorTx)} ↗
          </a>
        )}
      </div>
    );
  }

  const submit = async () => {
    if (!stars) return;
    setState("signing");
    setErr(null);
    try {
      const res = await submitClientFeedback(MONAD_CONTRACTS.reputationRegistry, run.agentId, r.callId, starsToScore(stars), `${stars}/5 stars`);
      setTx(res.txHash);
      setState("done");
      useActivityStore.getState().addActivity({
        type: "reputation_feedback",
        title: `Independent review · ${run.agentName}`,
        description: `${stars}/5 stars (${starsToScore(stars)}/100) from the paying wallet, tied to call ${r.callId.slice(0, 10)}…`,
        txHash: res.txHash,
        blockNumber: res.blockNumber,
        timestamp: new Date().toISOString(),
        status: "confirmed",
        from: res.from,
        to: MONAD_CONTRACTS.reputationRegistry,
        contractName: "ReputationRegistryV2",
        agentId: run.agentId,
        agentName: run.agentName,
        skill: run.skill,
        metadata: { scoreGiven: starsToScore(stars), callId: r.callId, reviewerKind: "Independent" }
      });
    } catch (e: any) {
      setErr(e?.shortMessage || e?.reason || e?.message || "Review failed");
      setState("error");
    }
  };

  return (
    <div className="px-4 py-3 border-t border-ink/20 font-mono text-[11px]">
      {state === "done" && tx ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-moss">
          <span>Independent review {stars}/5 recorded</span>
          <a href={`${EXPLORER}/tx/${tx}`} target="_blank" rel="noreferrer" className="hover:underline">
            {short(tx)} ↗
          </a>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-ink-2">Rate this call</span>
          <span className="flex" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setStars(n)}
                disabled={state === "signing"}
                className={`text-[18px] leading-none px-0.5 ${(hover || stars) >= n ? "text-flame" : "text-ink-3"}`}
              >
                ★
              </button>
            ))}
          </span>
          <button onClick={submit} disabled={!stars || state === "signing"} className="btn-ghost btn-sm disabled:opacity-50">
            {state === "signing" ? "Confirm in wallet…" : "Submit review"}
          </button>
          {err && <span className="text-flame basis-full">{err}</span>}
        </div>
      )}
    </div>
  );
};

const EXPLORER = "https://testnet.monadvision.com";
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-flame text-ink border-ink",
  high: "bg-flame-soft text-ink border-ink",
  medium: "bg-sun-soft text-ink border-ink",
  low: "bg-violet-soft text-ink border-ink",
  info: "bg-paper-shade text-ink-2 border-ink/40",
  gas: "bg-moss-soft text-ink border-ink"
};

const scoreInk = (s: number) => (s >= 75 ? "#1E7A46" : s >= 50 ? "#F2B705" : "#FF5A1F");

/** Printed dial for 0–100 scores */
const Dial: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const r = 32;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="#FBF8F2" stroke="#16130F" strokeWidth="1.5" />
        <circle cx="40" cy="40" r={r - 7} fill="none" stroke="#16130F" strokeOpacity="0.12" strokeWidth="8" />
        <motion.circle
          cx="40"
          cy="40"
          r={r - 7}
          fill="none"
          stroke={scoreInk(value)}
          strokeWidth="8"
          strokeDasharray={2 * Math.PI * (r - 7)}
          initial={{ strokeDashoffset: 2 * Math.PI * (r - 7) }}
          animate={{ strokeDashoffset: 2 * Math.PI * (r - 7) * (1 - value / 100) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[1.9rem] leading-none">{value}</span>
        <span className="font-mono text-[8.5px] uppercase tracking-wider text-ink-2 mt-0.5">{label}</span>
      </div>
      <span className="sr-only">{c}</span>
    </div>
  );
};

const Sheet: React.FC<{ run: AgentRun; title: string; children: React.ReactNode; index: number }> = ({ run, title, children, index }) => (
  <motion.article
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
    className="border-[1.5px] border-ink bg-paper"
  >
    <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b-[1.5px] border-ink">
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 border-[1.5px] border-ink bg-paper-card overflow-hidden flex items-end justify-center">
          <AgentPortrait variant={variantForSkill(run.skill)} crop="head" className="w-full h-full" animated={false} />
        </span>
        <span className="font-display text-xl leading-none">{title}</span>
      </div>
      <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-2">
        Nº {String(run.agentId).padStart(2, "0")}
        {run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ""}
      </span>
    </header>
    <div className="p-4">{children}</div>
    {run.review && <ReviewBar run={run} />}
  </motion.article>
);

const Cell: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="px-3 py-2 min-w-0 border-r border-b border-ink/15">
    <div className="font-mono text-[9.5px] uppercase tracking-wider text-ink-3">{k}</div>
    <div className="font-mono text-[12px] text-ink mt-0.5 truncate">{v}</div>
  </div>
);

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-4 grid grid-cols-3 border-t border-l border-ink/15">{children}</div>
);

const RiskCard: React.FC<{ run: AgentRun; i: number }> = ({ run, i }) => {
  const d = run.result;
  return (
    <Sheet run={run} title="Token risk" index={i}>
      <div className="flex gap-4 items-center">
        <Dial value={d.score} label={d.riskTier || "risk"} />
        <div className="min-w-0">
          <div className="font-display text-2xl leading-tight truncate">
            {d.name || "Unknown"} {d.symbol && d.symbol !== d.name && <span className="text-ink-2">({d.symbol})</span>}
          </div>
          <a href={`${EXPLORER}/address/${d.tokenAddress}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-violet hover:underline">
            {short(d.tokenAddress)} ↗
          </a>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              ["Mint", d.hasMintCapability],
              ["Pause", d.hasPauseCapability],
              ["Blacklist", d.hasBlacklistCapability],
              ["Fees", d.hasFeeControls],
              ["Proxy", d.isProxy],
              ["Owner", d.hasOwner]
            ].map(([k, on]) => (
              <span key={k as string} className={`font-mono text-[10px] uppercase px-1.5 py-0.5 border ${on ? "border-ink bg-flame-soft text-ink" : "border-ink/20 text-ink-3 line-through"}`}>
                {k as string}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Grid>
        <Cell k="Supply" v={d.totalSupply || "—"} />
        <Cell k="Recipients" v={`${d.holderCountEstimate ?? 0}`} />
        <Cell k="Blocks" v={(d.blocksScanned ?? 0).toLocaleString()} />
      </Grid>
      {d.breakdown?.length > 0 && (
        <table className="mt-4 w-full text-[13px]">
          <tbody>
            {d.breakdown.map((b: any, k: number) => (
              <tr key={k} className="border-b border-dotted border-ink/30 last:border-b-0">
                <td className="py-1.5 text-ink-2">{b.factor}</td>
                <td className={`py-1.5 text-right font-mono ${b.impact < 0 ? "text-flame" : "text-moss"}`}>{b.impact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {d.knownAsset && <p className="mt-3 text-[12px] italic text-ink-2 leading-relaxed">{d.knownAsset}</p>}
    </Sheet>
  );
};

const AuditCard: React.FC<{ run: AgentRun; i: number }> = ({ run, i }) => {
  const d = run.result;
  return (
    <Sheet run={run} title="Contract audit" index={i}>
      <div className="flex gap-4 items-center">
        <Dial value={d.securityScore ?? 0} label="security" />
        <div className="min-w-0 space-y-1.5">
          <div className="font-display text-2xl leading-tight truncate">{d.contractName || short(d.contractAddress)}</div>
          <div className="flex flex-wrap gap-1.5">
            <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 border ${d.sourceVerified ? "border-ink bg-moss-soft" : "border-ink/30 text-ink-2"}`}>
              {d.sourceVerified ? `✓ ${d.verificationSource || "verified"}` : "bytecode only"}
            </span>
            {d.isProxy && <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 border border-ink bg-violet-soft">{d.proxyStandard} proxy</span>}
            {d.compilerVersion && <span className="font-mono text-[10px] px-1.5 py-0.5 border border-ink/30 text-ink-2">solc {String(d.compilerVersion).replace(/\+commit.*/, "")}</span>}
          </div>
          <div className="font-mono text-[11px] text-ink-2">
            {d.bytecodeSizeBytes?.toLocaleString()} bytes · {d.filesAnalyzed} source files
          </div>
        </div>
      </div>
      <ul className="mt-4 max-h-60 overflow-y-auto scrollbar-dark pr-1 border-t border-ink/15" data-lenis-prevent>
        {(d.findings || []).map((f: any, k: number) => (
          <li key={k} className="flex gap-2.5 items-start py-2 border-b border-dotted border-ink/25 last:border-b-0">
            <span className={`font-mono text-[9.5px] uppercase px-1.5 py-0.5 border shrink-0 ${SEVERITY_STYLE[f.severity]}`}>{f.severity}</span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-ink">{f.title}</div>
              <div className="text-[12px] text-ink-2 leading-snug">{f.detail}</div>
              {f.location && <div className="font-mono text-[10.5px] text-ink-3 truncate">{f.location}</div>}
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
};

const GasCard: React.FC<{ run: AgentRun; i: number }> = ({ run, i }) => {
  const d = run.result;
  const verdict = d.urgency === "send-now" ? "Send now" : d.urgency === "wait" ? "Wait" : "Normal";
  return (
    <Sheet run={run} title="Gas & timing" index={i}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-display text-[3.4rem] leading-none">
            {d.currentGasPriceGwei}
            <span className="text-lg text-ink-2 ml-1">gwei</span>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-ink-2 mt-2">
            base {d.baseFeeGwei} · {d.trend} {d.trendPct !== undefined ? `${d.trendPct}%` : ""}
          </div>
        </div>
        <span className={`stamp ${d.urgency === "wait" ? "border-flame text-flame" : "border-moss text-moss"}`}>{verdict}</span>
      </div>
      <div className="mt-4">
        <div className="flex justify-between font-mono text-[10.5px] uppercase tracking-wider text-ink-2">
          <span>Block utilisation · {d.congestionLabel}</span>
          <span>{d.blockUtilizationPct}%</span>
        </div>
        <div className="mt-1.5 h-3 border-[1.5px] border-ink bg-paper-card overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(2, Math.min(100, d.blockUtilizationPct || 0))}%` }}
            transition={{ duration: 1 }}
            className="h-full halftone-flame"
          />
        </div>
      </div>
      <Grid>
        <Cell k="Block time" v={`${d.avgBlockTimeSec}s`} />
        <Cell k="Tip" v={`${d.priorityFeeTiersGwei?.standard ?? d.optimalPriorityFeeGwei} gwei`} />
        <Cell k="Max fee" v={`${d.optimalMaxFeeGwei} gwei`} />
        <Cell k="MON send" v={`${d.estimatedCostsMON?.transfer}`} />
        <Cell k="ERC-20" v={`${d.estimatedCostsMON?.erc20Transfer}`} />
        <Cell k="Swap" v={`${d.estimatedCostsMON?.swap}`} />
      </Grid>
      <p className="mt-3 text-[13px] text-ink-2 leading-relaxed">{d.recommendation}</p>
    </Sheet>
  );
};

const WhaleCard: React.FC<{ run: AgentRun; i: number }> = ({ run, i }) => {
  const d = run.result;
  return (
    <Sheet run={run} title="Whale & liquidity" index={i}>
      <div className="flex gap-4 items-center">
        <Dial value={d.whaleActivityScore ?? 0} label="activity" />
        <div className="min-w-0">
          <div className="font-display text-2xl leading-tight truncate" title={d.monitoredAsset}>
            {String(d.monitoredAsset).replace(/\s*\(0x[a-fA-F0-9]{40}\)/, "")}
          </div>
          <div className="text-[13px] text-ink-2 mt-1">{d.sentiment}</div>
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-ink-3 mt-1.5">
            blocks {d.fromBlock}–{d.toBlock} · liquidity {d.liquidityHealth}
          </div>
        </div>
      </div>
      <table className="mt-4 w-full font-mono text-[11.5px]">
        <tbody>
          {(d.recentLargeTransfers || []).slice(0, 5).map((t: any, k: number) => (
            <tr key={k} className="border-b border-dotted border-ink/30 last:border-b-0">
              <td className="py-1.5 text-ink-2">
                {short(t.from)} → {short(t.to)} {t.toContract && <span className="text-violet">[c]</span>}
              </td>
              <td className="py-1.5 text-right">
                <a href={t.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink hover:text-violet">
                  {t.amount} <ExternalLink size={10} />
                </a>
              </td>
            </tr>
          ))}
          {!d.recentLargeTransfers?.length && (
            <tr>
              <td className="py-2 text-ink-3">No whale-sized moves in this window.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Sheet>
  );
};

const GenericCard: React.FC<{ run: AgentRun; i: number }> = ({ run, i }) => (
  <Sheet run={run} title={run.agentName} index={i}>
    <pre className="font-mono text-[11px] text-ink-2 whitespace-pre-wrap max-h-56 overflow-y-auto scrollbar-dark" data-lenis-prevent>
      {JSON.stringify(run.result, null, 2)}
    </pre>
  </Sheet>
);

export const AgentResultCards: React.FC<{ runs: AgentRun[] }> = ({ runs }) => {
  if (!runs.length) return null;
  return (
    <div className="mt-10">
      <div className="flex items-center gap-3 mb-4">
        <span className="kicker text-ink">5. Field reports</span>
        <span className="flex-1 h-px bg-ink/20" />
        <span className="font-mono text-[11px] text-ink-2">live Monad Testnet data</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {runs.map((run, i) => {
          const d = run.result;
          if (!d) return <GenericCard key={i} run={run} i={i} />;
          if (run.skill === "token-risk-score") return <RiskCard key={i} run={run} i={i} />;
          if (run.skill === "contract-audit") return <AuditCard key={i} run={run} i={i} />;
          if (run.skill === "gas-timing") return <GasCard key={i} run={run} i={i} />;
          if (d.whaleActivityScore !== undefined) return <WhaleCard key={i} run={run} i={i} />;
          return <GenericCard key={i} run={run} i={i} />;
        })}
      </div>
    </div>
  );
};
