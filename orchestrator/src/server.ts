import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import * as path from "path";
import { decomposeTask } from "./router";
import { executeModeA } from "./modeA";
import { buildSummary, polishSummary, OrchestratorResults } from "./synthesizer";
import { ethers } from "ethers";

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
  const orchestratorAddress = process.env.ORCHESTRATOR_WALLET_ADDRESS || "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B";
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

// Broadcast verified onchain feedback to Monad Testnet
app.post("/api/feedback", async (req, res) => {
  try {
    const { agentId = 1, score = 95, note = "Verified onchain agent feedback", reviewer } = req.body;
    const rawKey = process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    const privateKey = rawKey ? (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) : undefined;
    const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
    const repAddress = process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0";

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey as string, provider);
    const repAbi = [
      "function submitFeedbackFor(uint256 agentId, address reviewer, uint8 score, string note) external",
      "function getReputation(uint256 agentId) external view returns (uint256 avgScore, uint256 feedbackCount)"
    ];

    const repContract = new ethers.Contract(repAddress, repAbi, wallet);
    const targetReviewer = reviewer || wallet.address;

    const tx = await repContract.submitFeedbackFor(agentId, targetReviewer, Math.min(100, Math.max(0, score)), note);
    const receipt = await tx.wait();
    const [avg, count] = await repContract.getReputation(agentId);

    return res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `https://testnet.monadvision.com/tx/${tx.hash}`,
      reputation: {
        agentId,
        avgScore: Number(avg),
        feedbackCount: Number(count)
      }
    });
  } catch (err: any) {
    console.error("[Feedback Broadcast Error]:", err);
    return res.status(500).json({ error: "Failed to broadcast feedback onchain", details: err.message });
  }
});

// Main orchestration endpoint
app.post("/api/orchestrate", async (req, res) => {
  try {
    const { taskText, mode = "A", authorizations } = req.body;

    if (!taskText || typeof taskText !== "string") {
      return res.status(400).json({ error: "taskText string is required" });
    }

    // 1. Decompose task into subtasks
    const subtasks = decomposeTask(taskText);

    if (subtasks.length === 0) {
      return res.status(400).json({
        error: "Task Unroutable",
        message: "Unable to decompose task into specialized subtasks. Please include a token or contract address (0x...) and/or specify what you'd like analyzed (e.g., 'gas', 'risk', 'audit')."
      });
    }

    // 2. Mode B: client provided payment authorizations
    if (mode === "B" && authorizations && Array.isArray(authorizations)) {
      const steps = [];
      const results: OrchestratorResults = {};

      const rawKey = process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
      const privateKey = rawKey ? (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) : undefined;
      const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
      const repAddress = process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0";

      let repContract: ethers.Contract | null = null;
      if (privateKey) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const wallet = new ethers.Wallet(privateKey, provider);
          repContract = new ethers.Contract(repAddress, ["function recordPaidCall(uint256 agentId, address client) external"], wallet);
        } catch (e) {
          console.warn("Could not init repContract in Mode B:", e);
        }
      }

      for (let i = 0; i < subtasks.length; i++) {
        const subtask = subtasks[i];
        const auth = authorizations[i];

        let requestBody: any = {};
        if (subtask.skill === "token-risk-score") {
          requestBody = { tokenAddress: subtask.tokenAddress };
        } else if (subtask.skill === "contract-audit") {
          requestBody = { contractAddress: subtask.contractAddress };
        } else if (subtask.skill === "gas-timing") {
          requestBody = { network: "monad-testnet" };
        }

        const agentRes = await fetch(subtask.targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Payment-Authorization": typeof auth === "string" ? auth : JSON.stringify(auth)
          },
          body: JSON.stringify(requestBody)
        });

        const agentJson = await agentRes.json();
        let onchainTxHash = agentJson.settlement?.txHash;
        let blockNumber: number | undefined;

        if (repContract) {
          try {
            const agentId = subtask.skill === "contract-audit" ? 1 : subtask.skill === "token-risk-score" ? 2 : 3;
            const clientAddress = (auth && typeof auth === "object" && auth.from) || "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B";
            const tx = await repContract.recordPaidCall(agentId, clientAddress);
            onchainTxHash = tx.hash;
            const receipt = await tx.wait();
            blockNumber = receipt.blockNumber;
          } catch (onchainErr: any) {
            console.warn("[Orchestrator Mode B] recordPaidCall notice:", onchainErr.message);
          }
        }

        steps.push({
          subtask,
          status: agentRes.ok ? "completed" : "failed",
          settlement: {
            ...agentJson.settlement,
            txHash: onchainTxHash,
            blockNumber,
            explorerUrl: `https://testnet.monadvision.com/tx/${onchainTxHash}`
          },
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
