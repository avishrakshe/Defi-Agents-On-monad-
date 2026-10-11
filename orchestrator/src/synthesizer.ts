export interface OrchestratorResults {
  riskScore?: {
    score: number;
    riskTier?: string;
    name?: string;
    symbol?: string;
    explanation: string;
    hasMintCapability?: boolean;
    hasPauseCapability?: boolean;
    hasBlacklistCapability?: boolean;
    isProxy?: boolean;
    knownAsset?: string;
    flags?: string[];
  };
  gasTiming?: {
    currentGasPriceGwei: number;
    trend: string;
    trendPct?: number;
    recommendation: string;
    congestionScore?: number;
    congestionLabel?: string;
    blockUtilizationPct?: number;
    avgBlockTimeSec?: number;
    estimatedCostsMON?: { transfer: number; erc20Transfer: number; swap: number };
  };
  audit?: {
    criticalIssues: string[];
    mediumIssues: string[];
    gasOptimizations: string[];
    sourceVerified?: boolean;
    verificationSource?: string;
    contractName?: string;
    securityScore?: number;
    riskLevel?: string;
    isProxy?: boolean;
    privilegedFunctions?: string[];
    findings?: { severity: string; title: string }[];
  };
  [custom: string]: any;
}

/**
 * Deterministic Template Synthesis
 * Built directly from structured specialist agent responses — every number comes from an agent.
 */
export function buildSummary(results: OrchestratorResults): string {
  const parts: string[] = [];
  const verdicts: string[] = [];

  const r = results.riskScore;
  if (r) {
    const label = !r.symbol ? "Token" : r.name && r.name !== r.symbol ? `${r.name} (${r.symbol})` : r.symbol;
    const controls = [r.hasMintCapability && "mintable", r.hasPauseCapability && "pausable", r.hasBlacklistCapability && "blacklist", r.isProxy && "upgradeable"].filter(Boolean);
    parts.push(
      `TOKEN RISK — ${label}: ${r.score}/100 (${r.riskTier || "scored"}). ` +
        (controls.length ? `Admin controls: ${controls.join(", ")}.` : "No privileged supply or transfer controls detected.") +
        (r.knownAsset ? ` ${r.knownAsset}` : "")
    );
    verdicts.push(r.score >= 75 ? "token looks safe" : r.score >= 50 ? "token carries moderate admin risk" : r.knownAsset ? "token is issuer-controlled" : "token is high-risk");
  }

  const a = results.audit;
  if (a) {
    const crit = a.criticalIssues?.length ?? 0;
    const med = a.mediumIssues?.length ?? 0;
    const name = a.contractName ? `${a.contractName}` : "Contract";
    const src = a.sourceVerified ? `verified source via ${a.verificationSource || "Sourcify"}` : "bytecode-only (unverified)";
    const top = a.findings?.find((f) => f.severity === "critical" || f.severity === "high") || a.findings?.find((f) => f.severity === "medium");
    parts.push(
      `AUDIT — ${name}${a.isProxy ? " (proxy)" : ""}: security ${a.securityScore ?? "—"}/100, ${crit} critical/high, ${med} medium, ${a.gasOptimizations?.length ?? 0} gas notes; ${src}.` +
        (top ? ` Top issue: ${top.title}.` : "")
    );
    verdicts.push(crit > 0 ? "contract has serious findings" : med > 0 ? "contract has medium findings to review" : "contract audit is clean");
  }

  const g = results.gasTiming;
  if (g) {
    parts.push(
      `GAS — ${g.currentGasPriceGwei} gwei, ${g.trend}${g.trendPct !== undefined ? ` (${g.trendPct}%)` : ""}` +
        (g.blockUtilizationPct !== undefined ? `, blocks ${g.blockUtilizationPct}% full` : "") +
        (g.avgBlockTimeSec ? `, ${g.avgBlockTimeSec}s blocks` : "") +
        `. ${g.recommendation}`
    );
    verdicts.push(g.congestionLabel === "Congested" ? "wait for gas" : "gas is good to transact");
  }

  for (const [key, val] of Object.entries(results)) {
    if (["riskScore", "gasTiming", "audit"].includes(key) || !val || typeof val !== "object") continue;
    if (val.summary) parts.push(`WHALES — ${String(val.summary).replace(/^Whale & Liquidity:\s*/, "")}`);
    else if (val.recommendation) parts.push(val.recommendation);
  }

  if (!parts.length) return "No data was returned from the selected agents.";
  return `${parts.join("\n\n")}${verdicts.length > 1 ? `\n\nBottom line: ${verdicts.join("; ")}.` : ""}`;
}

/**
 * Optional LLM Polish
 * Wraps, NEVER replaces or blocks, the template summary.
 */
export async function polishSummary(deterministicSummary: string): Promise<{ summary: string; polished: boolean }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim() === "") return { summary: deterministicSummary, polished: false };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a DeFi assistant. Rewrite the following summary naturally and concisely for a trader while keeping all exact numbers, addresses, and recommendations strictly identical."
          },
          { role: "user", content: deterministicSummary }
        ],
        max_tokens: 300
      }),
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content?.trim();
      if (text) return { summary: text, polished: true };
    }
  } catch (err: any) {
    console.warn("[orchestrator] Optional LLM polish skipped, using template summary:", err.message);
  }
  return { summary: deterministicSummary, polished: false };
}
