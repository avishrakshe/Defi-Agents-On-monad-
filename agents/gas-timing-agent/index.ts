import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import * as path from "path";
import { analyzeGasTiming } from "./gasAnalyzer";
import { createX402Middleware } from "../shared/x402Middleware";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.GAS_TIMING_PORT || 4003;

app.use(cors());
app.use(express.json());

const x402 = createX402Middleware(
  "gas-timing",
  `http://localhost:${PORT}/api/gas`
);

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    agent: "Gas Price & Transaction Timing Agent",
    skill: "gas-timing",
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get("/info", (req, res) => {
  res.json({
    name: "Gas Price & Transaction Timing Agent",
    skill: "gas-timing",
    priceUSDC: "$0.001",
    dataSource: "Monad Testnet RPC eth_gasPrice & eth_feeHistory",
    description: "Monitors live gas price and fee velocity on Monad Testnet to provide predictive execution windows."
  });
});

// Paid x402 endpoint
app.all("/api/gas", x402, async (req, res) => {
  try {
    const timing = await analyzeGasTiming();
    return res.json({
      success: true,
      agent: "Gas Price & Transaction Timing Agent",
      skill: "gas-timing",
      settlement: (req as any).x402Settlement,
      data: timing
    });
  } catch (err: any) {
    console.error("[Gas Timing Agent Error]:", err);
    return res.status(500).json({ error: "Gas analysis failed", details: err.message });
  }
});

// Free preview endpoint
app.all("/api/gas/preview", async (req, res) => {
  try {
    const timing = await analyzeGasTiming();
    return res.json({
      success: true,
      mode: "preview",
      data: timing
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Gas preview failed", details: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Gas Price & Transaction Timing Agent] listening on port ${PORT}`);
  });
}

export default app;
