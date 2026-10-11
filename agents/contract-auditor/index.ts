import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import * as path from "path";
import { auditContract } from "./auditor";
import { createX402Middleware } from "../shared/x402Middleware";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.CONTRACT_AUDITOR_PORT || 4001;

app.use(cors());
app.use(express.json());

const x402 = createX402Middleware(
  "contract-audit",
  `http://localhost:${PORT}/api/audit`
);

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    agent: "Smart Contract Auditor",
    skill: "contract-audit",
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get("/info", (req, res) => {
  res.json({
    name: "Smart Contract Auditor",
    skill: "contract-audit",
    priceUSDC: "$0.001",
    dataSource: "Sourcify verified source + Monad RPC bytecode disassembly",
    description: "Resolves proxies, pulls verified source from Sourcify, runs deterministic static rules (reentrancy, tx.origin, unchecked calls, selfdestruct) and decodes runtime bytecode for dangerous opcodes and privileged functions."
  });
});

// Paid x402 endpoint
app.post("/api/audit", x402, async (req, res) => {
  try {
    const { contractAddress } = req.body;
    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      return res.status(400).json({ error: "Valid Ethereum-style contract address required" });
    }

    const audit = await auditContract(contractAddress);
    return res.json({
      success: true,
      agent: "Smart Contract Auditor",
      skill: "contract-audit",
      settlement: (req as any).x402Settlement,
      data: audit
    });
  } catch (err: any) {
    console.error("[Auditor Agent Error]:", err);
    return res.status(500).json({ error: "Audit failed", details: err.message });
  }
});

// Free preview endpoint for rapid testing
app.post("/api/audit/preview", async (req, res) => {
  try {
    const { contractAddress } = req.body;
    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      return res.status(400).json({ error: "Valid Ethereum-style contract address required" });
    }
    const audit = await auditContract(contractAddress);
    return res.json({
      success: true,
      mode: "preview",
      data: audit
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Preview failed", details: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Smart Contract Auditor Agent] listening on port ${PORT}`);
  });
}

export default app;
