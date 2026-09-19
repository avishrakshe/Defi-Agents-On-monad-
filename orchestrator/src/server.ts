import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import * as path from "path";
import { decomposeTask } from "./router";
import { executeModeA } from "./modeA";
import { buildSummary, polishSummary, OrchestratorResults } from "./synthesizer";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    service: "DeFi Task Orchestrator",
    network: process.env.NEXT_PUBLIC_MONAD_NETWORK || "eip155:10143",
    chainId: 10143,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/status", (req, res) => {
  const orchestratorAddress = process.env.ORCHESTRATOR_WALLET_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  res.json({
    orchestratorAddress,
    balanceUSDC: "100.00 tUSDC",
    network: "Monad Testnet",
    chainId: 10143,
    llmPolishAvailable: !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
    registeredAgents: [
      { id: 1, name: "Smart Contract Auditor", skill: "contract-audit", port: 4001 },
      { id: 2, name: "Token Risk Scorer", skill: "token-risk-score", port: 4002 },
      { id: 3, name: "Gas Price & Timing Agent", skill: "gas-timing", port: 4003 }
    ]
  });
});

// Primary task orchestration endpoint
app.post("/api/orchestrate", async (req, res) => {
  try {
    const { taskText, mode = "A", signedAuthorizations = {} } = req.body;

    if (!taskText || typeof taskText !== "string" || taskText.trim().length === 0) {
      return res.status(400).json({
        error: "Missing task description",
        message: "Please provide a natural-language DeFi query."
      });
    }

    // Phase 3 Deterministic Task Decomposition
    const subtasks = decomposeTask(taskText);

    if (subtasks.length === 0) {
      return res.status(400).json({
        error: "Task Unroutable",
        message: "Unable to decompose task into specialized subtasks. Please include a token or contract address (0x...) and/or specify what you'd like analyzed (e.g., 'gas', 'risk', 'audit')."
      });
    }

    // Mode B: Client signed payments flow
    if (mode === "B") {
      // Check if client has provided signed authorizations for all subtasks
      const missingAuths = subtasks.filter(st => !signedAuthorizations[st.skill]);
      if (missingAuths.length > 0) {
        return res.status(402).json({
          mode: "Mode B: Your Wallet",
          status: "Payment Authorization Required",
          taskText,
          subtasks,
          instructions: "Client signature required for each subtask via x402 / EIP-3009.",
          paymentRequests: missingAuths.map(st => ({
            skill: st.skill,
            agentName: st.agentName,
            price: st.priceUSDC,
            priceUnits: "1000",
            asset: process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3",
            network: process.env.NEXT_PUBLIC_MONAD_NETWORK || "eip155:10143",
            payTo: process.env.PAY_TO_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
          }))
        });
      }

      // Execute with client's signed authorizations
      const steps: any[] = [];
      const results: OrchestratorResults = {};

      for (const subtask of subtasks) {
        const auth = signedAuthorizations[subtask.skill];
        let requestBody: any = {};
        if (subtask.skill === "token-risk-score") requestBody = { tokenAddress: subtask.tokenAddress };
        else if (subtask.skill === "contract-audit") requestBody = { contractAddress: subtask.contractAddress };
        else if (subtask.skill === "gas-timing") requestBody = { network: "monad-testnet" };

        const agentRes = await fetch(subtask.targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Payment-Authorization": typeof auth === "string" ? auth : JSON.stringify(auth)
          },
          body: JSON.stringify(requestBody)
        });

        const agentJson = await agentRes.json();
        steps.push({
          subtask,
          status: agentRes.ok ? "completed" : "failed",
          settlement: agentJson.settlement,
          result: agentJson.data
        });

        if (subtask.skill === "token-risk-score") results.riskScore = agentJson.data;
        else if (subtask.skill === "gas-timing") results.gasTiming = agentJson.data;
        else if (subtask.skill === "contract-audit") results.audit = agentJson.data;
      }

      const deterministicSummary = buildSummary(results);
      const { summary, polished } = await polishSummary(deterministicSummary);

      return res.json({
        mode: "Mode B: Your Wallet",
        taskText,
        subtasks,
        steps,
        results,
        summary,
        polished,
        totalCostUSDC: `$${(subtasks.length * 0.001).toFixed(3)}`,
        timestamp: new Date().toISOString()
      });
    }

    // Default Mode A: Autonomous
    const executionResult = await executeModeA(taskText, subtasks);
    return res.json(executionResult);

  } catch (err: any) {
    console.error("[Orchestrator Error]:", err);
    return res.status(500).json({ error: "Internal Orchestrator Error", details: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[DeFi Task Orchestrator] listening on port ${PORT}`);
  });
}

export default app;
