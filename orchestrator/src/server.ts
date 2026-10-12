import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { ethers } from "ethers";
import { decomposeTask, Subtask, toSubtask } from "./router";
import { executeAll } from "./modeA";
import { executeSubtask } from "./executor";
import { buildSummary, polishSummary } from "./synthesizer";
import { getBalances, getOrchestratorWallet, getProvider } from "./x402Client";
import { measureBlockTime } from "../../agents/gas-timing-agent/gasAnalyzer";
import {
  IDENTITY_V2_ABI,
  REPUTATION_V2_ABI,
  identityAddress,
  listRegistryAgents,
  reputationAddress,
  stakeManagerAddress
} from "../../agents/shared/registry";
import { chainFromRequest, getChain } from "./chains";
import { subtaskFor } from "./chains/magicblock";
import { magicblockRouter } from "./magicblockRoutes";
import { listSolanaAgents, mbConnections, mbEnv, mbPdas, num, operatorKeypair, readLive } from "../../agents/shared/solanaMarket";
import { PublicKey } from "@solana/web3.js";

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 4000;
const EXPLORER = () => process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://testnet.monadvision.com";
const isBytes32 = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);

app.use(cors({ exposedHeaders: ["X-Payment-Response"] }));
app.use(express.json());
app.use(magicblockRouter);

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

const AGENT_URL_ENV: Record<string, string> = {
  "contract-audit": "CONTRACT_AUDITOR_URL",
  "token-risk-score": "TOKEN_RISK_URL",
  "gas-timing": "GAS_TIMING_URL",
  "whale-tracker": "WHALE_AGENT_URL"
};

// Agents with owner, payee, stake and split reputation, for either network
app.get("/api/agents", async (req, res) => {
  const chain = chainFromRequest(req);
  try {
    return res.json({ chain, agents: await getChain(chain).listAgents() });
  } catch (err: any) {
    return res.status(502).json({ error: `Could not read ${chain} registry`, details: err.shortMessage || err.message });
  }
});

// Live orchestrator status: real balances + reachability of each registered specialist
app.get("/api/status", async (req, res) => {
  if (chainFromRequest(req) === "magicblock") {
    try {
      const op = operatorKeypair();
      const { base } = mbConnections();
      const cfg = await readLive(mbPdas.config(), "Config");
      const mint = mbEnv().usdcMint || (cfg ? String((cfg.data as any).usdc_mint ?? (cfg.data as any).usdcMint) : "");
      const [sol, tab, tokenAccounts, agents] = await Promise.all([
        op ? base.getBalance(op.publicKey) : Promise.resolve(null),
        op ? readLive(mbPdas.tab(op.publicKey), "Tab") : Promise.resolve(null),
        op && mint ? base.getParsedTokenAccountsByOwner(op.publicKey, { mint: new PublicKey(mint) }) : Promise.resolve(null),
        listSolanaAgents().catch(() => [])
      ]);
      const usdcUnits = tokenAccounts ? tokenAccounts.value.reduce((s: number, a: any) => s + Number(a.account.data.parsed.info.tokenAmount.amount), 0) : null;
      return res.json({
        chain: "magicblock",
        network: "Solana devnet + MagicBlock ER",
        operatorAddress: op?.publicKey.toBase58() ?? null,
        balanceSOL: sol === null ? null : sol / 1e9,
        balanceTUSDCBase: usdcUnits === null ? null : usdcUnits / 1e6,
        tab: tab ? { delegated: tab.delegated, availableTUSDC: (num(tab.data.deposited) - num(tab.data.spent)) / 1e6 } : null,
        validator: mbEnv().validator,
        erRpc: mbEnv().erRpc,
        programId: mbEnv().programId,
        usdcMint: mint,
        agents: agents.map((a) => ({ id: a.id, name: a.name, skill: a.skill, owner: a.owner, payee: a.payee, active: a.active }))
      });
    } catch (err: any) {
      return res.status(502).json({ error: "Could not read MagicBlock status", details: err.message });
    }
  }
  const wallet = getOrchestratorWallet();
  const address = wallet?.address || process.env.ORCHESTRATOR_WALLET_ADDRESS || null;
  const registry = await listRegistryAgents().catch(() => []);
  const [balances, health] = await Promise.all([
    address ? getBalances(address).catch(() => null) : Promise.resolve(null),
    Promise.all(
      registry.map(async (a) => {
        const envBase = AGENT_URL_ENV[a.skill] && process.env[AGENT_URL_ENV[a.skill]];
        const healthUrl = envBase ? `${envBase.replace(/\/$/, "")}/health` : a.endpoint.replace(/\/api\/[^/]+$/, "/health");
        let online = false;
        try {
          online = (await fetch(healthUrl, { signal: AbortSignal.timeout(2500) })).ok;
        } catch {}
        return { id: a.id, name: a.name, skill: a.skill, owner: a.owner, payee: a.payee, active: a.active, online };
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
    contracts: { identityRegistry: identityAddress(), reputationRegistry: reputationAddress(), stakeManager: stakeManagerAddress() },
    llmPolishAvailable: !!process.env.OPENAI_API_KEY,
    agents: health
  });
});

/**
 * Operator review for a Mode A call the orchestrator itself paid for. Stored as Operator in ReputationRegistryV2;
 * the contract refuses calls a client paid for, so this endpoint can't pre-empt a user's own review.
 */
app.post("/api/feedback", async (req, res) => {
  if (chainFromRequest(req) === "magicblock") {
    const { agentId, callId, score, note = "" } = req.body || {};
    if (!Number.isInteger(agentId) || !/^[0-9a-f]{32}$/i.test(String(callId)) || typeof score !== "number") {
      return res.status(400).json({ error: "agentId (int), callId (32 hex chars) and score (0-100) are required" });
    }
    try {
      return res.json({ success: true, ...(await getChain("magicblock").submitFeedback({ agentId, callId }, score, note)) });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to submit operator review on the ER", details: err.message });
    }
  }
  try {
    const { agentId, callId, score, note = "" } = req.body || {};
    if (!Number.isInteger(agentId) || !isBytes32(callId) || typeof score !== "number") {
      return res.status(400).json({ error: "agentId (int), callId (bytes32) and score (0-100) are required" });
    }
    const wallet = requireWallet();
    const rep = new ethers.Contract(reputationAddress(), REPUTATION_V2_ABI, wallet);
    const tx = await rep.submitFeedbackFor(agentId, callId, Math.min(100, Math.max(0, Math.round(score))), String(note).slice(0, 280));
    const receipt = await tx.wait();
    const [[, , avgInd, countInd], [avgOp, countOp]] = await Promise.all([rep.getReputation(agentId), rep.getOperatorReputation(agentId)]);

    return res.json({
      success: true,
      kind: "Operator",
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER()}/tx/${tx.hash}`,
      reputation: {
        agentId,
        independent: { avg: Number(avgInd), count: Number(countInd) },
        operator: { avg: Number(avgOp), count: Number(countOp) }
      }
    });
  } catch (err: any) {
    console.error("[Feedback Broadcast Error]:", err.shortMessage || err.message);
    return res.status(500).json({ error: "Failed to broadcast feedback onchain", details: err.shortMessage || err.message });
  }
});

// One-shot orchestration (decompose → execute all → synthesize). Mode A only: Mode B needs a 402 round trip per
// agent in the browser, which the step-by-step /api/execute-step flow provides.
app.post("/api/orchestrate", async (req, res) => {
  try {
    const { taskText } = req.body;
    if (!taskText || typeof taskText !== "string") {
      return res.status(400).json({ error: "taskText string is required" });
    }

    const chain = chainFromRequest(req);
    const subtasks = await getChain(chain).decompose(taskText);
    if (subtasks.length === 0) {
      return res.status(400).json({
        error: "Task Unroutable",
        message: "Unable to decompose task into specialized subtasks. Please include a token or contract address (0x...) and/or specify what you'd like analyzed (e.g., 'gas', 'risk', 'audit')."
      });
    }
    return res.json({ chain, ...(await executeAll(taskText, subtasks, "A", undefined, chain)) });
  } catch (err: any) {
    console.error("[Orchestrator Error]:", err);
    return res.status(500).json({ error: "Internal Orchestrator Error", details: err.message });
  }
});

/**
 * Relayed registration: the operator pays the gas, registers with payee = ownerAddress and immediately transfers
 * ownership to ownerAddress, so the operator never ends up owning a community agent.
 */
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

    if (!name || !skill || !endpoint) return res.status(400).json({ error: "name, skill, and endpoint are required" });
    if (!ownerAddress || !ethers.isAddress(ownerAddress)) {
      return res.status(400).json({ error: "ownerAddress (the wallet that will own the agent and receive its payments) is required" });
    }
    const owner = ethers.getAddress(ownerAddress);

    const wallet = requireWallet();
    const identity = new ethers.Contract(identityAddress(), IDENTITY_V2_ABI, wallet);
    const metadata = { description, dataSource, registeredVia: "DeFi Agent Marketplace (operator-relayed)" };

    const tx = await identity.registerAgent(name, skill, endpoint, priceUSDC, JSON.stringify(metadata), owner);
    const receipt = await tx.wait();

    let agentId: number | null = null;
    for (const log of receipt?.logs || []) {
      try {
        const parsed = identity.interface.parseLog(log);
        if (parsed?.name === "AgentRegistered") {
          agentId = Number(parsed.args.agentId);
          break;
        }
      } catch {}
    }
    if (agentId === null) throw new Error("AgentRegistered event not found");

    const transferTx = await identity.transferAgentOwnership(agentId, owner);
    await transferTx.wait();
    await listRegistryAgents(true).catch(() => undefined);

    return res.json({
      success: true,
      agentId,
      txHash: tx.hash,
      transferTxHash: transferTx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER()}/tx/${tx.hash}`,
      agent: { id: agentId, name, skill, endpoint, priceUSDC: `$${(Number(priceUSDC) / 1_000_000).toFixed(3)}`, owner, payee: owner }
    });
  } catch (err: any) {
    console.error("[Agent Registration Error]:", err.shortMessage || err.message);
    return res.status(500).json({ error: "Failed to register agent onchain", details: err.shortMessage || err.message });
  }
});

// Decompose and annotate every subtask with its live registry status, stake and split reputation
app.post("/api/decompose", async (req, res) => {
  const { taskText } = req.body;
  if (!taskText) return res.status(400).json({ error: "taskText required" });

  if (chainFromRequest(req) === "magicblock") {
    try {
      const adapter = getChain("magicblock");
      const [subtasks, agents] = await Promise.all([adapter.decompose(taskText), adapter.listAgents()]);
      const withTrust = subtasks.map((s) => {
        const a = agents.find((x) => x.id === s.agentId);
        return {
          ...s,
          trust: a && {
            registered: true,
            active: a.active,
            owner: a.owner,
            payee: a.payee,
            stakeUSDC: a.stakeUnits === null ? null : Number(a.stakeUnits) / 1e6,
            independent: a.independent,
            operator: a.operator
          }
        };
      });
      return res.json({ chain: "magicblock", subtasks: withTrust });
    } catch (err: any) {
      return res.status(502).json({ error: "Could not read agent_market registry", details: err.message });
    }
  }

  try {
    const subtasks: (Subtask & { trust?: any })[] = await decomposeTask(taskText);
    const registry = await listRegistryAgents();
    const rep = new ethers.Contract(reputationAddress(), REPUTATION_V2_ABI, getProvider());
    const stake = new ethers.Contract(stakeManagerAddress(), ["function getStake(uint256) view returns (uint256)"], getProvider());
    await Promise.all(
      subtasks.map(async (s) => {
        const reg = registry.find((a) => a.id === s.agentId);
        const [r, op, st] = await Promise.all([
          rep.getReputation(s.agentId).catch(() => null),
          rep.getOperatorReputation(s.agentId).catch(() => null),
          stake.getStake(s.agentId).catch(() => null)
        ]);
        s.trust = {
          registered: !!reg,
          active: !!reg?.active,
          owner: reg?.owner,
          payee: reg?.payee,
          stakeUSDC: st === null ? null : Number(st) / 1e6,
          independent: r ? { avg: Number(r[2]), count: Number(r[3]) } : null,
          operator: op ? { avg: Number(op[0]), count: Number(op[1]) } : null
        };
      })
    );
    return res.json({ subtasks });
  } catch (err: any) {
    console.warn("Decompose failed:", err.shortMessage || err.message);
    return res.status(502).json({ error: "Could not read IdentityRegistryV2", details: err.shortMessage || err.message });
  }
});

// Execute a single subtask (used by the frontend for step-by-step streaming)
app.post("/api/execute-step", async (req, res) => {
  try {
    const { subtask: requested, mode = "A", authorization } = req.body;
    if (!Number.isInteger(requested?.agentId)) return res.status(400).json({ error: "subtask with agentId required" });
    const pickAddr = (v: unknown) => (typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v) ? v : undefined);

    if (chainFromRequest(req) === "magicblock") {
      const a = (await listSolanaAgents()).find((x) => x.id === requested.agentId && x.active);
      if (!a) return res.status(400).json({ error: `Agent #${requested.agentId} is not an active agent_market agent` });
      const subtask = subtaskFor(a, { tokenAddress: pickAddr(requested.tokenAddress), contractAddress: pickAddr(requested.contractAddress) });
      const step = await getChain("magicblock").payForCall(subtask, { mode: mode === "B" ? "B" : "A", authorization });
      return res.json({ success: true, chain: "magicblock", subtask, settlement: step.settlement, result: step.result, durationMs: step.durationMs });
    }

    // The target URL, skill and price come from the registry record, never from the request
    const reg = (await listRegistryAgents()).find((a) => a.id === requested.agentId);
    if (!reg || !reg.active) return res.status(400).json({ error: `Agent #${requested.agentId} is not an active IdentityRegistryV2 agent` });
    const pick = (v: unknown) => (typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v) ? v : undefined);
    const subtask = toSubtask(reg, { tokenAddress: pick(requested.tokenAddress), contractAddress: pick(requested.contractAddress) });

    const step = await executeSubtask({ subtask, mode: mode === "B" ? "B" : "A", authorization });
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
