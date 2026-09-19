import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import * as path from "path";
import { scoreTokenRisk } from "./scorer";
import { createX402Middleware } from "../shared/x402Middleware";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.TOKEN_RISK_PORT || 4002;

app.use(cors());
app.use(express.json());

const x402 = createX402Middleware(
  "token-risk-score",
  `http://localhost:${PORT}/api/score`
);

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    agent: "Token Risk Scorer",
    skill: "token-risk-score",
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get("/info", (req, res) => {
  res.json({
    name: "Token Risk Scorer",
    skill: "token-risk-score",
    priceUSDC: "$0.001",
    dataSource: "Monad Testnet RPC eth_call & Event Logs",
    description: "Evaluates ERC-20 smart contracts on Monad Testnet for dangerous owner backdoors, mint/freeze abilities, and holder concentration."
  });
});

// Paid x402 endpoint
app.post("/api/score", x402, async (req, res) => {
  try {
    const { tokenAddress } = req.body;
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return res.status(400).json({ error: "Valid Ethereum-style token address required" });
    }

    const risk = await scoreTokenRisk(tokenAddress);
    return res.json({
      success: true,
      agent: "Token Risk Scorer",
      skill: "token-risk-score",
      settlement: (req as any).x402Settlement,
      data: risk
    });
  } catch (err: any) {
    console.error("[Token Risk Agent Error]:", err);
    return res.status(500).json({ error: "Risk score evaluation failed", details: err.message });
  }
});

// Free preview endpoint
app.post("/api/score/preview", async (req, res) => {
  try {
    const { tokenAddress } = req.body;
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return res.status(400).json({ error: "Valid Ethereum-style token address required" });
    }
    const risk = await scoreTokenRisk(tokenAddress);
    return res.json({
      success: true,
      mode: "preview",
      data: risk
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Preview failed", details: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Token Risk Scorer Agent] listening on port ${PORT}`);
  });
}

export default app;
