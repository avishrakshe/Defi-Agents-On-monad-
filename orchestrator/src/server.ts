import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { ethers } from "ethers";
import { decomposeTask, Subtask } from "./router";
import { executeAll } from "./modeA";
import { executeSubtask } from "./executor";
import { buildSummary, polishSummary } from "./synthesizer";
import { getBalances, getOrchestratorWallet, getProvider } from "./x402Client";
import { measureBlockTime } from "../../agents/gas-timing-agent/gasAnalyzer";

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 4000;

const IDENTITY = () => process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "0xD62b32482874E447Beb60E6Df5A21E6ebaFf54ad";
const REPUTATION = () => process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0";
const EXPLORER = () => process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://testnet.monadvision.com";

const IDENTITY_ABI = [
  "function registerAgent(string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI) external returns (uint256)",
  "function getAllAgents() external view returns (tuple(uint256 id, address owner, string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, uint256 registeredAt, bool active)[])",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string skill, string name, uint256 priceUSDC, string endpoint, string metadataURI)"
];

app.use(cors());
app.use(express.json());

const requireWallet = () => {
  const w = getOrchestratorWallet();
  if (!w) throw new Error("ORCHESTRATOR_PRIVATE_KEY is not configured");
  return w;
};

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    service: "DeFi Task Orchestrator",
    network: process.env.NEXT_PUBLIC_MONAD_NETWORK || "eip155:10143",
    chainId: 10143,
    timestamp: new Date().toISOString()
  });
});

// Live chain metrics: average block time over the last 200 blocks, cached for 30s
let chainMetricsCache: { at: number; body: any } | null = null;
app.get("/api/chain-metrics", async (req, res) => {
  try {
    if (!chainMetricsCache || Date.now() - chainMetricsCache.at > 30_000) {
      const { avgBlockTimeSec, latestBlock, windowBlocks } = await measureBlockTime();
      chainMetricsCache = {
        at: Date.now(),
        body: { chainId: 10143, avgBlockTimeSec, avgBlockTimeMs: Math.round(avgBlockTimeSec * 1000), windowBlocks, latestBlock, measuredAt: new Date().toISOString() }
      };
    }
    res.set("Cache-Control", "public, max-age=30");
    return res.json({ ...chainMetricsCache.body, cacheAgeSec: Math.round((Date.now() - chainMetricsCache.at) / 1000) });
  } catch (err: any) {
    return res.status(502).json({ error: "Could not measure block time", details: err.message });
  }
});

// Live orchestrator status: real balances + reachability of each specialist
app.get("/api/status", async (req, res) => {
  const wallet = getOrchestratorWallet();
  const address = wallet?.address || process.env.ORCHESTRATOR_WALLET_ADDRESS || null;
  const agents = [
    { id: 1, name: "Smart Contract Auditor", skill: "contract-audit", url: process.env.CONTRACT_AUDITOR_URL || "http://localhost:4001" },
    { id: 2, name: "Token Risk Scorer", skill: "token-risk-score", url: process.env.TOKEN_RISK_URL || "http://localhost:4002" },
    { id: 3, name: "Gas Price & Timing Agent", skill: "gas-timing", url: process.env.GAS_TIMING_URL || "http://localhost:4003" },
    { id: 4, name: "Whale & Liquidity Sentinel", skill: "whale-tracker", url: process.env.WHALE_AGENT_URL || "http://localhost:4004" }
  ];
  const [balances, health] = await Promise.all([
    address ? getBalances(address).catch(() => null) : Promise.resolve(null),
    Promise.all(
      agents.map(async (a) => {
        try {
          const r = await fetch(`${a.url}/health`, { signal: AbortSignal.timeout(2500) });
          return { ...a, online: r.ok };
        } catch {
          return { ...a, online: false };
        }
      })
    )
  ]);

  res.json({
    orchestratorAddress: address,
    balanceMON: balances?.mon ?? null,
    balanceUSDC: balances?.usdc ?? null,
    canSettlePayments: balances ? Number(balances.usdc) >= 0.001 : false,
    network: "Monad Testnet",
    chainId: 10143,
    llmPolishAvailable: !!process.env.OPENAI_API_KEY,
    agents: health
  });
});

// Broadcast verified onchain feedback to Monad Testnet
app.post("/api/feedback", async (req, res) => {
  try {
    const { agentId = 1, score = 95, note = "Verified onchain agent feedback", reviewer } = req.body;
    const wallet = requireWallet();
    const rep = new ethers.Contract(
      REPUTATION(),
      [
        "function submitFeedbackFor(uint256 agentId, address reviewer, uint8 score, string note) external",
        "function getReputation(uint256 agentId) external view returns (uint256 avgScore, uint256 feedbackCount)"
      ],
      wallet
    );

    const tx = await rep.submitFeedbackFor(agentId, reviewer || wallet.address, Math.min(100, Math.max(0, Math.round(score))), String(note).slice(0, 280));
    const receipt = await tx.wait();
    const [avg, count] = await rep.getReputation(agentId);

    return res.json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER()}/tx/${tx.hash}`,
      reputation: { agentId, avgScore: Number(avg), feedbackCount: Number(count) }
    });
  } catch (err: any) {
    console.error("[Feedback Broadcast Error]:", err.shortMessage || err.message);
    return res.status(500).json({ error: "Failed to broadcast feedback onchain", details: err.shortMessage || err.message });
  }
});

// One-shot orchestration (decompose → execute all → synthesize)
app.post("/api/orchestrate", async (req, res) => {
  try {
    const { taskText, mode = "A", authorizations } = req.body;
    if (!taskText || typeof taskText !== "string") {
      return res.status(400).json({ error: "taskText string is required" });
    }

    const subtasks = decomposeTask(taskText);
    if (subtasks.length === 0) {
      return res.status(400).json({
        error: "Task Unroutable",
        message: "Unable to decompose task into specialized subtasks. Please include a token or contract address (0x...) and/or specify what you'd like analyzed (e.g., 'gas', 'risk', 'audit')."
      });
    }

    const useB = mode === "B" && Array.isArray(authorizations);
    return res.json(await executeAll(taskText, subtasks, useB ? "B" : "A", useB ? authorizations : undefined));
  } catch (err: any) {
    console.error("[Orchestrator Error]:", err);
    return res.status(500).json({ error: "Internal Orchestrator Error", details: err.message });
  }
});

// Onchain agent registration
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

    const wallet = requireWallet();
    const identity = new ethers.Contract(IDENTITY(), IDENTITY_ABI, wallet);
    const metadata = { description, dataSource, author: ownerAddress || wallet.address, registeredVia: "DeFi Agent Marketplace Monad" };

    const tx = await identity.registerAgent(name, skill, endpoint, priceUSDC, JSON.stringify(metadata));
    const receipt = await tx.wait();

    let registeredAgentId: number | null = null;
    for (const log of receipt?.logs || []) {
      try {
        const parsed = identity.interface.parseLog(log);
        if (parsed?.name === "AgentRegistered") {
          registeredAgentId = Number(parsed.args.agentId);
          break;
        }
      } catch {}
    }

    return res.json({
      success: true,
      agentId: registeredAgentId,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER()}/tx/${tx.hash}`,
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
    console.error("[Agent Registration Error]:", err.shortMessage || err.message);
    return res.status(500).json({ error: "Failed to register agent onchain", details: err.shortMessage || err.message });
  }
});

// Decompose with dynamic onchain discovery of community agents
app.post("/api/decompose", async (req, res) => {
  const { taskText } = req.body;
  if (!taskText) return res.status(400).json({ error: "taskText required" });

  const subtasks: Subtask[] = decomposeTask(taskText);
  const addresses: string[] = taskText.match(/0x[a-fA-F0-9]{40}/g) || [];

  try {
    const identity = new ethers.Contract(IDENTITY(), IDENTITY_ABI, getProvider());
    const onchainAgents = await identity.getAllAgents();
    const lower = taskText.toLowerCase();

    for (const a of onchainAgents) {
      const id = Number(a.id);
      if (id <= 3 || !a.active) continue;
      const skill = String(a.skill).toLowerCase();
      const name = String(a.name).toLowerCase();
      const keywords = skill.split(/[-_\s]/).concat(name.split(/[\s&]+/)).filter((k: string) => k.length > 3);

      if (lower.includes(skill) || lower.includes(name) || keywords.some((k: string) => lower.includes(k))) {
        // Deployment-provided URLs win over the onchain endpoint (agent #4 is registered at localhost:4004, and its
        // registry record is still controlled by the retired operator key, so it must not be trusted blindly)
        const override = id === 4 && process.env.WHALE_AGENT_URL ? `${process.env.WHALE_AGENT_URL}/api/whale` : undefined;
        subtasks.push({
          agentId: id,
          skill: a.skill,
          targetUrl: override || a.endpoint,
          priceUSDC: `$${(Number(a.priceUSDC) / 1_000_000).toFixed(3)}`,
          agentName: a.name,
          tokenAddress: addresses[0]
        });
      }
    }
    // Trust check: annotate every subtask with its live registry status and onchain reputation
    const rep = new ethers.Contract(
      REPUTATION(),
      ["function getReputation(uint256 agentId) external view returns (uint256 avgScore, uint256 feedbackCount)"],
      getProvider()
    );
    await Promise.all(
      subtasks.map(async (s: any) => {
        const reg = onchainAgents.find((a: any) => Number(a.id) === s.agentId);
        const [avg, count] = await rep.getReputation(s.agentId).catch(() => [0n, 0n]);
        s.trust = { registered: !!reg, active: !!reg?.active, owner: reg?.owner, avgScore: Number(avg), feedbackCount: Number(count) };
      })
    );
  } catch (err: any) {
    console.warn("Could not query dynamic onchain agents:", err.shortMessage || err.message);
  }

  return res.json({ subtasks });
});

// Execute a single subtask (used by the frontend for step-by-step streaming)
app.post("/api/execute-step", async (req, res) => {
  try {
    const { subtask, mode = "A", authorization, clientAddress } = req.body;
    if (!subtask?.targetUrl) return res.status(400).json({ error: "subtask with targetUrl required" });

    const step = await executeSubtask({ subtask, mode, authorization, clientAddress });
    return res.json({ success: true, subtask, settlement: step.settlement, result: step.result, durationMs: step.durationMs });
  } catch (err: any) {
    console.error("[execute-step Error]:", err.message);
    return res.status(502).json({ error: "Failed to execute step", details: err.message });
  }
});

// Issue the soulbound Monad Scholar credential (owner-only on AcademyCredential, so it must be signed here —
// the operator key never leaves the server)
app.post("/api/issue-credential", async (req, res) => {
  try {
    const { recipient, learnerName } = req.body || {};
    const name = String(learnerName || "").trim().slice(0, 64);
    if (!name) return res.status(400).json({ error: "learnerName required" });

    const wallet = requireWallet();
    const to = recipient && ethers.isAddress(recipient) ? ethers.getAddress(recipient) : wallet.address;
    const credential = new ethers.Contract(
      process.env.NEXT_PUBLIC_ACADEMY_CREDENTIAL_ADDRESS || "0xAbAFE53736e087877561cd0E48C283D6e7e59Ce6",
      [
        "function issueCredential(address learner, string learnerName, string uri) external returns (uint256)",
        "function balanceOf(address owner) view returns (uint256)",
        "event CredentialIssued(uint256 indexed tokenId, address indexed learner, string learnerName, uint256 completedAt, string tokenURI)"
      ],
      wallet
    );

    // One credential per external wallet — stops anyone from draining gas with repeat mints
    if (to !== wallet.address) {
      const held = await credential.balanceOf(to).catch(() => 0n);
      if (held > 0n) return res.status(409).json({ error: "Credential already issued to this wallet" });
    }

    const uri = JSON.stringify({
      title: "Monad Academy Scholar Credential",
      learner: name,
      completedAt: new Date().toISOString(),
      paths: ["Monad Fundamentals", "Tokenized Assets", "x402 Payments"],
      issuer: "Monad Academy"
    });
    const tx = await credential.issueCredential(to, name, uri);
    const receipt = await tx.wait();

    let tokenId: string | null = null;
    for (const log of receipt?.logs || []) {
      try {
        const parsed = credential.interface.parseLog(log);
        if (parsed?.name === "CredentialIssued") {
          tokenId = parsed.args.tokenId.toString();
          break;
        }
      } catch {}
    }

    return res.json({ success: true, txHash: tx.hash, blockNumber: receipt.blockNumber, tokenId, recipient: to, issuer: wallet.address, explorerUrl: `${EXPLORER()}/tx/${tx.hash}` });
  } catch (err: any) {
    console.error("[Credential Error]:", err.shortMessage || err.message);
    return res.status(500).json({ error: "Failed to issue credential", details: err.shortMessage || err.message });
  }
});

// Synthesize results
app.post("/api/synthesize", async (req, res) => {
  try {
    const { results } = req.body;
    const { summary, polished } = await polishSummary(buildSummary(results || {}));
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
