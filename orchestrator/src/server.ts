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

// Onchain Agent Registration endpoint
app.post("/api/register-agent", async (req, res) => {
  try {
    const {
      name,
      skill,
      endpoint,
      priceUSDC = 1000,
      description = "Custom autonomous DeFi agent on Monad Testnet",
      dataSource = "Custom Monad RPC / API",
      ownerAddress
    } = req.body;

    if (!name || !skill || !endpoint) {
      return res.status(400).json({ error: "name, skill, and endpoint are required" });
    }

    const rawKey = process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    const privateKey = rawKey ? (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) : undefined;
    const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
    const identityAddress = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "0xD62b32482874E447Beb60E6Df5A21E6ebaFf54ad";

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey as string, provider);

    const identityAbi = [
      "function registerAgent(string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI) external returns (uint256)",
      "function getAllAgents() external view returns (tuple(uint256 id, address owner, string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, uint256 registeredAt, bool active)[])",
      "event AgentRegistered(uint256 indexed agentId, address indexed owner, string skill, string name, uint256 priceUSDC, string endpoint, string metadataURI)"
    ];

    const identityContract = new ethers.Contract(identityAddress, identityAbi, wallet);

    const metadataObj = {
      description,
      dataSource,
      author: ownerAddress || wallet.address,
      registeredVia: "DeFi Agent Marketplace Monad"
    };

    const tx = await identityContract.registerAgent(
      name,
      skill,
      endpoint,
      priceUSDC,
      JSON.stringify(metadataObj)
    );

    const receipt = await tx.wait();

    // Find AgentRegistered event
    let registeredAgentId = null;
    if (receipt && receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = identityContract.interface.parseLog(log);
          if (parsed && parsed.name === "AgentRegistered") {
            registeredAgentId = Number(parsed.args.agentId);
            break;
          }
        } catch {}
      }
    }

    return res.json({
      success: true,
      agentId: registeredAgentId,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `https://testnet.monadvision.com/tx/${tx.hash}`,
      agent: {
        id: registeredAgentId,
        name,
        skill,
        endpoint,
        priceUSDC: `$${(Number(priceUSDC) / 1_000_000).toFixed(3)}`,
        owner: ownerAddress || wallet.address
      }
    });
  } catch (err: any) {
    console.error("[Agent Registration Error]:", err);
    return res.status(500).json({ error: "Failed to register agent onchain", details: err.message });
  }
});

// Decompose task endpoint with dynamic onchain agent discovery
app.post("/api/decompose", async (req, res) => {
  const { taskText } = req.body;
  if (!taskText) return res.status(400).json({ error: "taskText required" });
  
  // 1. Base router decomposition
  const subtasks = decomposeTask(taskText);

  // 2. Query dynamic custom agents registered onchain
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
    const identityAddress = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "0xD62b32482874E447Beb60E6Df5A21E6ebaFf54ad";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const identityAbi = [
      "function getAllAgents() external view returns (tuple(uint256 id, address owner, string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, uint256 registeredAt, bool active)[])"
    ];
    const identityContract = new ethers.Contract(identityAddress, identityAbi, provider);
    const onchainAgents = await identityContract.getAllAgents();

    const lower = taskText.toLowerCase();
    for (const a of onchainAgents) {
      const id = Number(a.id);
      if (id <= 3 || !a.active) continue;

      const skill = a.skill.toLowerCase();
      const name = a.name.toLowerCase();

      // Check if task mentions skill or name keywords
      if (
        lower.includes(skill) ||
        lower.includes(name) ||
        (skill.includes("whale") && lower.includes("whale")) ||
        (skill.includes("liquidity") && lower.includes("liquidity")) ||
        (skill.includes("arbitrage") && lower.includes("arbitrage"))
      ) {
        subtasks.push({
          skill: a.skill,
          targetUrl: a.endpoint,
          priceUSDC: `$${(Number(a.priceUSDC) / 1_000_000).toFixed(3)}`,
          agentName: a.name
        });
      }
    }
  } catch (err) {
    console.warn("Could not query dynamic onchain agents:", err);
  }

  return res.json({ subtasks });
});

// Execute a single subtask sequentially with onchain verification & settlement
app.post("/api/execute-step", async (req, res) => {
  try {
    const { subtask, mode = "A", authorization, clientAddress } = req.body;
    if (!subtask) return res.status(400).json({ error: "subtask required" });

    const rawKey = process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    const privateKey = rawKey ? (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) : undefined;
    const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    let signerWallet: ethers.Wallet | null = null;
    if (privateKey) {
      try {
        signerWallet = new ethers.Wallet(privateKey, provider);
      } catch (e) {
        console.warn("Could not instantiate wallet:", e);
      }
    }

    const orchestratorAddress = signerWallet?.address || "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B";
    const payTo = process.env.PAY_TO_ADDRESS || orchestratorAddress;
    const asset = process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3";
    const repAddress = process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0";

    const domain = {
      name: "USD Coin",
      version: "2",
      chainId: 10143,
      verifyingContract: asset
    };

    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" }
      ]
    };

    let paymentAuthStr = "";

    if (mode === "B" && authorization) {
      paymentAuthStr = typeof authorization === "string" ? authorization : JSON.stringify(authorization);
    } else {
      const now = Math.floor(Date.now() / 1000);
      const validAfter = now - 60;
      const validBefore = now + 3600;
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const value = "1000";

      let signature = "";
      if (signerWallet) {
        const message = {
          from: orchestratorAddress,
          to: payTo,
          value,
          validAfter,
          validBefore,
          nonce
        };
        signature = await signerWallet.signTypedData(domain, types, message);
      }

      paymentAuthStr = JSON.stringify({
        scheme: "exact",
        network: "eip155:10143",
        from: orchestratorAddress,
        to: payTo,
        value,
        validAfter,
        validBefore,
        nonce,
        signature
      });
    }

    let requestBody: any = {};
    if (subtask.skill === "token-risk-score") {
      requestBody = { tokenAddress: subtask.tokenAddress };
    } else if (subtask.skill === "contract-audit") {
      requestBody = { contractAddress: subtask.contractAddress };
    } else if (subtask.skill === "gas-timing") {
      requestBody = { network: "monad-testnet" };
    } else {
      requestBody = {
        tokenAddress: subtask.tokenAddress || "0x534b2f3A21130d7a60830c2Df862319e593943A3",
        contractAddress: subtask.contractAddress || "0x534b2f3A21130d7a60830c2Df862319e593943A3",
        network: "monad-testnet"
      };
    }

    const agentRes = await fetch(subtask.targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Authorization": paymentAuthStr
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(12000)
    });

    if (!agentRes.ok) {
      throw new Error(`Specialist agent HTTP ${agentRes.status}: ${agentRes.statusText}`);
    }

    const agentJson = await agentRes.json();

    // Broadcast onchain recordPaidCall
    let onchainTxHash = agentJson.settlement?.txHash;
    let blockNumber: number | undefined;

    if (signerWallet) {
      try {
        const repAbi = ["function recordPaidCall(uint256 agentId, address client) external"];
        const repContract = new ethers.Contract(repAddress, repAbi, signerWallet);
        const agentId = subtask.skill === "contract-audit" ? 1 : subtask.skill === "token-risk-score" ? 2 : 3;
        const payer = clientAddress || (mode === "B" && authorization?.from ? authorization.from : orchestratorAddress);
        const tx = await repContract.recordPaidCall(agentId, payer);
        onchainTxHash = tx.hash;
        const receipt = await tx.wait();
        blockNumber = receipt.blockNumber;
      } catch (onchainErr: any) {
        console.warn("[execute-step] Onchain recordPaidCall notice:", onchainErr.message);
      }
    }

    return res.json({
      success: true,
      subtask,
      settlement: {
        ...agentJson.settlement,
        txHash: onchainTxHash,
        blockNumber,
        explorerUrl: `https://testnet.monadvision.com/tx/${onchainTxHash}`
      },
      result: agentJson.data
    });
  } catch (err: any) {
    console.error("[execute-step Error]:", err);
    return res.status(500).json({ error: "Failed to execute step", details: err.message });
  }
});

// Synthesize results endpoint
app.post("/api/synthesize", async (req, res) => {
  try {
    const { results } = req.body;
    const deterministicSummary = buildSummary(results || {});
    const { summary, polished } = await polishSummary(deterministicSummary);
    return res.json({ summary, polished });
  } catch (err: any) {
    return res.status(500).json({ error: "Synthesis failed", details: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[DeFi Task Orchestrator] listening on port ${PORT}`);
  });
}

export default app;
