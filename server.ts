/**
 * Backend entry for Vercel: mounts the orchestrator and all four specialist agents in one Express app.
 *
 *   /                      orchestrator API (/api/decompose, /api/execute-step, /api/status, ...)
 *   /agents/auditor        Smart Contract Auditor      (/api/audit)
 *   /agents/risk           Token Risk Scorer           (/api/score)
 *   /agents/gas            Gas & Timing Agent          (/api/gas)
 *   /agents/whale          Whale & Liquidity Sentinel  (/api/whale)
 *   /mb/agents/*           the same four agents on the MagicBlock rail (x402 "er-tab", paid on the Ephemeral Rollup)
 *
 * The orchestrator reaches the agents over HTTP via CONTRACT_AUDITOR_URL / TOKEN_RISK_URL / GAS_TIMING_URL /
 * WHALE_AGENT_URL, so the same code runs locally (separate ports) and here (path prefixes).
 */
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import orchestratorApp from "./orchestrator/src/server";
import auditorApp from "./agents/contract-auditor/index";
import riskApp from "./agents/token-risk-scorer/index";
import gasApp from "./agents/gas-timing-agent/index";
import whaleApp from "./agents/sample-custom-agent";

const app = express();
app.use(cors());
app.set("trust proxy", true);

// Routes that make the operator wallet send transactions. Throttle them per IP so a public deployment
// can't be used to burn the operator's gas (best-effort: counters live per serverless instance).
const WRITE_ROUTES = new Set([
  "/api/feedback",
  "/api/register-agent",
  "/api/issue-credential",
  "/api/execute-step",
  "/api/orchestrate",
  "/api/checkpoint",
  "/api/magicblock/faucet",
  "/api/magicblock/relay"
]);
const WINDOW_MS = 10 * 60 * 1000;
const MAX_WRITES = Number(process.env.WRITE_RATE_LIMIT || 40);
const hits = new Map<string, { count: number; reset: number }>();

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "POST" || !WRITE_ROUTES.has(req.path)) return next();
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return next();
  }
  if (++entry.count > MAX_WRITES) {
    return res.status(429).json({ error: "Too many onchain write requests — try again in a few minutes." });
  }
  next();
});

app.use("/agents/auditor", auditorApp);
app.use("/agents/risk", riskApp);
app.use("/agents/gas", gasApp);
app.use("/agents/whale", whaleApp);

// MagicBlock rail: the same agents, paid with a pay_for_call settled on the Ephemeral Rollup (x402 "er-tab")
const magicblockRail = (req: Request, _res: Response, next: NextFunction) => {
  (req as any).paymentRail = "magicblock";
  next();
};
app.use("/mb/agents/auditor", magicblockRail, auditorApp);
app.use("/mb/agents/risk", magicblockRail, riskApp);
app.use("/mb/agents/gas", magicblockRail, gasApp);
app.use("/mb/agents/whale", magicblockRail, whaleApp);
app.use("/", orchestratorApp);

export default app;

if (require.main === module) {
  const port = process.env.PORT || 8080;
  app.listen(port, () => console.log(`[DeFi Agents backend] listening on :${port}`));
}
