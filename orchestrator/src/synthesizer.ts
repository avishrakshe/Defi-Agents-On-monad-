export interface OrchestratorResults {
  riskScore?: {
    score: number;
    explanation: string;
    hasMintCapability?: boolean;
    hasPauseCapability?: boolean;
    flags?: string[];
  };
  gasTiming?: {
    currentGasPriceGwei: number;
    trend: string;
    recommendation: string;
    congestionScore?: number;
  };
  audit?: {
    criticalIssues: string[];
    mediumIssues: string[];
    gasOptimizations: string[];
    sourceVerified?: boolean;
  };
}

/**
 * Deterministic Template Synthesis
 * Built directly from structured specialist agent responses.
 */
export function buildSummary(results: OrchestratorResults): string {
  const parts: string[] = [];

  if (results.riskScore) {
    parts.push(`Token risk score: ${results.riskScore.score}/100 — ${results.riskScore.explanation}`);
  }

  if (results.gasTiming) {
    parts.push(`Gas on Monad: ${results.gasTiming.currentGasPriceGwei} gwei, trend ${results.gasTiming.trend}. Recommendation: ${results.gasTiming.recommendation}`);
  }

  if (results.audit) {
    parts.push(`Contract audit: ${results.audit.criticalIssues.length} critical issue(s), ${results.audit.mediumIssues.length} medium issue(s), ${results.audit.gasOptimizations.length} gas optimization(s) found.`);
  }

  return parts.length > 0 ? parts.join(" ") : "No data was returned from the selected agents.";
}

/**
 * Optional LLM Polish
 * Wraps, NEVER replaces or blocks, the template summary.
 */
export async function polishSummary(deterministicSummary: string): Promise<{ summary: string; polished: boolean }> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    return { summary: deterministicSummary, polished: false };
  }

  try {
    if (process.env.OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a DeFi assistant. Rewrite the following summary naturally and concisely for a trader while keeping all exact numbers, addresses, and recommendations strictly identical."
            },
            {
              role: "user",
              content: deterministicSummary
            }
          ],
          max_tokens: 150
        }),
        signal: AbortSignal.timeout(4000)
      });

      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content?.trim();
        if (text && text.length > 0) {
          return { summary: text, polished: true };
        }
      }
    }
  } catch (err: any) {
    console.warn("[orchestrator] Optional LLM polish skipped, using template summary:", err.message);
  }

  return { summary: deterministicSummary, polished: false };
}
