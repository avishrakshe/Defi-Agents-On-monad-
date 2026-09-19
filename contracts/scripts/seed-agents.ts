import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const [operator] = await ethers.getSigners();
  const manifestPath = path.resolve(__dirname, "../deployed-addresses.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("deployed-addresses.json not found. Run deploy first.");
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  const identityRegistry = await ethers.getContractAt("IdentityRegistry", manifest.identityRegistry);
  const stakeManager = await ethers.getContractAt("StakeManager", manifest.stakeManager);
  const usdc = await ethers.getContractAt("IERC20", manifest.usdc);

  console.log("Seeding 3 Specialist DeFi Agents...");

  const agents = [
    {
      name: "Smart Contract Auditor",
      skill: "contract-audit",
      endpoint: process.env.CONTRACT_AUDITOR_URL || "http://localhost:4001",
      priceUSDC: 1000n, // $0.001 USDC (6 decimals)
      metadataURI: JSON.stringify({
        name: "Smart Contract Auditor",
        skill: "contract-audit",
        endpoint: process.env.CONTRACT_AUDITOR_URL || "http://localhost:4001",
        priceUSDC: "$0.001",
        description: "Monadscan verified source code static security analysis. Detects reentrancy, unchecked calls, authorization bypass, and gas optimizations.",
        dataSource: "Monadscan Public API + Static AST Analyzer",
        author: "Monad Security Guild"
      }),
      stakeAmount: 100_000_000n // 100 USDC
    },
    {
      name: "Token Risk Scorer",
      skill: "token-risk-score",
      endpoint: process.env.TOKEN_RISK_URL || "http://localhost:4002",
      priceUSDC: 1000n, // $0.001 USDC
      metadataURI: JSON.stringify({
        name: "Token Risk Scorer",
        skill: "token-risk-score",
        endpoint: process.env.TOKEN_RISK_URL || "http://localhost:4002",
        priceUSDC: "$0.001",
        description: "Onchain inspection of ERC-20 tokens on Monad Testnet. Evaluates owner privileges, mint/freeze backdoors, and top-holder concentration.",
        dataSource: "Monad Testnet RPC eth_call & Event Logs",
        author: "Monad Risk Protocol"
      }),
      stakeAmount: 100_000_000n // 100 USDC
    },
    {
      name: "Gas Price & Transaction Timing Agent",
      skill: "gas-timing",
      endpoint: process.env.GAS_TIMING_URL || "http://localhost:4003",
      priceUSDC: 1000n, // $0.001 USDC
      metadataURI: JSON.stringify({
        name: "Gas Price & Transaction Timing Agent",
        skill: "gas-timing",
        endpoint: process.env.GAS_TIMING_URL || "http://localhost:4003",
        priceUSDC: "$0.001",
        description: "Real-time fee oracle polling eth_gasPrice and eth_feeHistory. Computes congestion velocity and recommends optimal transaction submission windows.",
        dataSource: "Monad Testnet RPC eth_gasPrice & eth_feeHistory",
        author: "Monad FastPath Labs"
      }),
      stakeAmount: 100_000_000n // 100 USDC
    }
  ];

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    console.log(`\nRegistering #${i + 1}: ${a.name} (${a.skill})...`);
    const regTx = await identityRegistry.registerAgent(
      a.name,
      a.skill,
      a.endpoint,
      a.priceUSDC,
      a.metadataURI
    );
    const receipt = await regTx.wait();
    const agentId = BigInt(i + 1);

    // Staking
    try {
      console.log(`Approving & Staking ${Number(a.stakeAmount) / 1e6} USDC for agent #${agentId}...`);
      const approveTx = await usdc.approve(manifest.stakeManager, a.stakeAmount);
      await approveTx.wait();
      const stakeTx = await stakeManager.stake(agentId, a.stakeAmount);
      await stakeTx.wait();
      console.log(`>>> Agent #${agentId} successfully registered and staked.`);
    } catch (err: any) {
      console.warn(`Could not stake (balance or allowance issue): ${err.message}`);
    }
  }

  const allAgents = await identityRegistry.getAllAgents();
  console.log("\n--- Verification: getAllAgents() ---");
  for (const agent of allAgents) {
    const stake = await stakeManager.getStake(agent.id);
    console.log(`[Agent #${agent.id}] ${agent.name} | Skill: ${agent.skill} | Price: ${agent.priceUSDC} | Stake: ${Number(stake) / 1e6} USDC`);
  }
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exitCode = 1;
});
