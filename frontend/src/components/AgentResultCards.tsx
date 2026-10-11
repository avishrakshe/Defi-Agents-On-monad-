"use client";

import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ScanSearch, Fuel, Waves, ExternalLink, AlertTriangle, CheckCircle2, Bot } from "lucide-react";

export interface AgentRun {
  agentId: number;
  agentName: string;
  skill: string;
  result: any;
  durationMs?: number;
}

const EXPLORER = "https://testnet.monadvision.com";
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  medium: "bg-amber-400/15 text-amber-200 border-amber-400/40",
  low: "bg-sky-400/10 text-sky-200 border-sky-400/30",
  info: "bg-white/5 text-white/60 border-white/15",
  gas: "bg-[#836ef9]/15 text-[#c4b8ff] border-[#836ef9]/40"
};

const scoreColor = (s: number) => (s >= 75 ? "#ccff00" : s >= 50 ? "#facc15" : s >= 25 ? "#fb923c" : "#f43f5e");

/** Circular gauge for 0–100 scores */
const Gauge: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={scoreColor(value)}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${scoreColor(value)})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl text-white leading-none">{value}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-white/40 mt-1">{label}</span>
      </div>
    </div>
  );
};

const Shell: React.FC<{ icon: React.ElementType; title: string; meta?: string; children: React.ReactNode; index: number }> = ({
  icon: Icon,
  title,
  meta,
  children,
  index
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
    className="clip-chamfer bg-gradient-to-br from-white/[0.14] to-white/[0.03] p-px"
  >
    <div className="clip-chamfer bg-[#0c0c0d] p-5 h-full">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 clip-chamfer bg-gradient-to-br from-[#ccff00] to-[#8be000] text-black flex items-center justify-center">
            <Icon size={16} strokeWidth={2.4} />
          </span>
          <span className="font-display uppercase text-sm text-white">{title}</span>
        </div>
        {meta && <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">{meta}</span>}
      </div>
      {children}
    </div>
  </motion.div>
);

const Stat: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="border border-white/10 rounded px-3 py-2 min-w-0">
    <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">{k}</div>
    <div className="font-mono text-xs text-white mt-0.5 truncate">{v}</div>
  </div>
);

const RiskCard: React.FC<{ d: any; i: number; ms?: number }> = ({ d, i, ms }) => (
  <Shell icon={ScanSearch} title="Token risk" meta={ms ? `${(ms / 1000).toFixed(1)}s` : undefined} index={i}>
    <div className="flex gap-4 items-center">
      <Gauge value={d.score} label={d.riskTier || "risk"} />
      <div className="min-w-0">
        <div className="font-display text-lg text-white truncate">
          {d.name || "Unknown"} {d.symbol && d.symbol !== d.name && <span className="text-white/40">({d.symbol})</span>}
        </div>
        <a href={`${EXPLORER}/address/${d.tokenAddress}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-[#a594ff] hover:text-white">
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
            <span
              key={k as string}
              className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border ${on ? "border-orange-400/40 text-orange-300 bg-orange-400/10" : "border-white/10 text-white/30"}`}
            >
              {k as string}
            </span>
          ))}
        </div>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2">
      <Stat k="Supply" v={d.totalSupply || "—"} />
      <Stat k="Recipients" v={`${d.holderCountEstimate ?? 0}`} />
      <Stat k="Blocks scanned" v={(d.blocksScanned ?? 0).toLocaleString()} />
    </div>
    {d.breakdown?.length > 0 && (
      <ul className="mt-4 space-y-1.5">
        {d.breakdown.map((b: any, k: number) => (
          <li key={k} className="flex items-start justify-between gap-3 text-xs">
            <span className="text-white/60">{b.factor}</span>
            <span className={`font-mono shrink-0 ${b.impact < 0 ? "text-orange-300" : "text-[#ccff00]"}`}>{b.impact}</span>
          </li>
        ))}
      </ul>
    )}
    {d.knownAsset && <p className="mt-3 text-[11px] text-white/45 leading-relaxed">{d.knownAsset}</p>}
  </Shell>
);

const AuditCard: React.FC<{ d: any; i: number; ms?: number }> = ({ d, i, ms }) => (
  <Shell icon={ShieldCheck} title="Contract audit" meta={ms ? `${(ms / 1000).toFixed(1)}s` : undefined} index={i}>
    <div className="flex gap-4 items-center">
      <Gauge value={d.securityScore ?? 0} label="security" />
      <div className="min-w-0 space-y-1.5">
        <div className="font-display text-lg text-white truncate">{d.contractName || short(d.contractAddress)}</div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded border ${d.sourceVerified ? "border-[#ccff00]/40 text-[#ccff00] bg-[#ccff00]/10" : "border-white/15 text-white/50"}`}>
            {d.sourceVerified ? `✓ ${d.verificationSource || "verified"}` : "bytecode only"}
          </span>
          {d.isProxy && <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded border border-[#836ef9]/40 text-[#c4b8ff]">{d.proxyStandard} proxy</span>}
          {d.compilerVersion && <span className="font-mono text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/50">solc {String(d.compilerVersion).replace(/\+commit.*/, "")}</span>}
        </div>
        <div className="font-mono text-[11px] text-white/40">
          {d.bytecodeSizeBytes?.toLocaleString()} bytes · {d.filesAnalyzed} source files
        </div>
      </div>
    </div>
    <ul className="mt-4 space-y-1.5 max-h-56 overflow-y-auto scrollbar-dark pr-1" data-lenis-prevent>
      {(d.findings || []).map((f: any, k: number) => (
        <li key={k} className="flex gap-2 items-start">
          <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded border shrink-0 ${SEVERITY_STYLE[f.severity]}`}>{f.severity}</span>
          <div className="min-w-0">
            <div className="text-xs text-white">{f.title}</div>
            <div className="text-[11px] text-white/45 leading-snug">{f.detail}</div>
            {f.location && <div className="font-mono text-[10px] text-white/30 truncate">{f.location}</div>}
          </div>
        </li>
      ))}
    </ul>
  </Shell>
);

const GasCard: React.FC<{ d: any; i: number; ms?: number }> = ({ d, i, ms }) => (
  <Shell icon={Fuel} title="Gas & timing" meta={ms ? `${(ms / 1000).toFixed(1)}s` : undefined} index={i}>
    <div className="flex items-end justify-between gap-3">
      <div>
        <div className="font-display text-4xl text-white leading-none">
          {d.currentGasPriceGwei}
          <span className="text-sm text-white/40 ml-1">gwei</span>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-wider text-white/45 mt-2">
          base {d.baseFeeGwei} · trend {d.trend} {d.trendPct !== undefined ? `(${d.trendPct}%)` : ""}
        </div>
      </div>
      <span
        className={`font-mono text-[10px] uppercase px-2.5 py-1 rounded border ${
          d.urgency === "wait" ? "border-orange-400/40 text-orange-300" : "border-[#ccff00]/40 text-[#ccff00] bg-[#ccff00]/10"
        }`}
      >
        {d.urgency === "send-now" ? "Send now" : d.urgency === "wait" ? "Wait" : "Normal"}
      </span>
    </div>
    <div className="mt-4">
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-white/40">
        <span>Block utilisation · {d.congestionLabel}</span>
        <span>{d.blockUtilizationPct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(2, Math.min(100, d.blockUtilizationPct || 0))}%` }}
          transition={{ duration: 1 }}
          className="h-full bg-gradient-to-r from-[#ccff00] to-[#836ef9]"
        />
      </div>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2">
      <Stat k="Block time" v={`${d.avgBlockTimeSec}s`} />
      <Stat k="Tip (std)" v={`${d.priorityFeeTiersGwei?.standard ?? d.optimalPriorityFeeGwei} gwei`} />
      <Stat k="Max fee" v={`${d.optimalMaxFeeGwei} gwei`} />
      <Stat k="MON transfer" v={`${d.estimatedCostsMON?.transfer} MON`} />
      <Stat k="ERC-20 send" v={`${d.estimatedCostsMON?.erc20Transfer} MON`} />
      <Stat k="Swap" v={`${d.estimatedCostsMON?.swap} MON`} />
    </div>
    <p className="mt-3 text-[11px] text-white/55 leading-relaxed">{d.recommendation}</p>
  </Shell>
);

const WhaleCard: React.FC<{ d: any; i: number; ms?: number }> = ({ d, i, ms }) => (
  <Shell icon={Waves} title="Whale & liquidity" meta={ms ? `${(ms / 1000).toFixed(1)}s` : undefined} index={i}>
    <div className="flex gap-4 items-center">
      <Gauge value={d.whaleActivityScore ?? 0} label="activity" />
      <div className="min-w-0">
        <div className="font-display text-base text-white truncate" title={d.monitoredAsset}>
          {String(d.monitoredAsset).replace(/\s*\(0x[a-fA-F0-9]{40}\)/, "")}
        </div>
        <div className="text-xs text-white/55 mt-1">{d.sentiment}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-white/40 mt-1.5">
          blocks {d.fromBlock}–{d.toBlock} · liquidity {d.liquidityHealth}
        </div>
      </div>
    </div>
    <ul className="mt-4 space-y-1.5">
      {(d.recentLargeTransfers || []).slice(0, 5).map((t: any, k: number) => (
        <li key={k} className="flex items-center justify-between gap-2 font-mono text-[11px]">
          <span className="text-white/50 truncate">
            {short(t.from)} → {short(t.to)} {t.toContract && <span className="text-[#c4b8ff]">[contract]</span>}
          </span>
          <a href={t.explorerUrl} target="_blank" rel="noreferrer" className="text-[#ccff00] hover:text-white shrink-0 inline-flex items-center gap-1">
            {t.amount} <ExternalLink size={10} />
          </a>
        </li>
      ))}
      {!d.recentLargeTransfers?.length && <li className="text-xs text-white/40">No whale-sized moves in this window.</li>}
    </ul>
  </Shell>
);

const GenericCard: React.FC<{ run: AgentRun; i: number }> = ({ run, i }) => (
  <Shell icon={Bot} title={run.agentName} index={i}>
    <pre className="font-mono text-[11px] text-white/60 whitespace-pre-wrap max-h-56 overflow-y-auto scrollbar-dark" data-lenis-prevent>
      {JSON.stringify(run.result, null, 2)}
    </pre>
  </Shell>
);

export const AgentResultCards: React.FC<{ runs: AgentRun[] }> = ({ runs }) => {
  if (!runs.length) return null;
  return (
    <div className="mt-8">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/50 mb-3 flex items-center gap-2">
        <CheckCircle2 size={13} className="text-[#ccff00]" /> Agent outputs · live Monad Testnet data
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {runs.map((run, i) => {
          const d = run.result;
          if (!d) {
            return (
              <Shell key={i} icon={AlertTriangle} title={run.agentName} index={i}>
                <p className="text-xs text-white/50">No data returned.</p>
              </Shell>
            );
          }
          if (run.skill === "token-risk-score") return <RiskCard key={i} d={d} i={i} ms={run.durationMs} />;
          if (run.skill === "contract-audit") return <AuditCard key={i} d={d} i={i} ms={run.durationMs} />;
          if (run.skill === "gas-timing") return <GasCard key={i} d={d} i={i} ms={run.durationMs} />;
          if (d.whaleActivityScore !== undefined) return <WhaleCard key={i} d={d} i={i} ms={run.durationMs} />;
          return <GenericCard key={i} run={run} i={i} />;
        })}
      </div>
    </div>
  );
};
