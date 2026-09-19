import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=================================================");
  console.log("Deploying and Seeding DeFi Agent Marketplace Contracts");
  console.log("Network:", network.name, "(Chain ID:", (await ethers.provider.getNetwork()).chainId.toString(), ")");
  console.log("Deployer Address:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Native Balance:", ethers.formatEther(balance), "MON");
  console.log("=================================================");

  // 1. IdentityRegistry
  console.log("\n[1/3] Deploying IdentityRegistry...");
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityAddress = await identityRegistry.getAddress();
  console.log(">>> IdentityRegistry deployed to:", identityAddress);

  // 2. ReputationRegistry
  console.log("\n[2/3] Deploying ReputationRegistry...");
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy(identityAddress);
  await reputationRegistry.waitForDeployment();
  const reputationAddress = await reputationRegistry.getAddress();
  console.log(">>> ReputationRegistry deployed to:", reputationAddress);

  // 3. USDC Token and StakeManager
  let usdcAddress = process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3";
  let usdcContract: any;

  if (network.name === "hardhat" || network.name === "localhost") {
    console.log("\nDeploying MockUSDC for local environment...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    usdcAddress = await mockUSDC.getAddress();
    usdcContract = mockUSDC;
    console.log(">>> MockUSDC deployed to:", usdcAddress);
  } else {
    usdcContract = await ethers.getContractAt("IERC20", usdcAddress);
  }

  console.log("\n[3/3] Deploying StakeManager with USDC:", usdcAddress);
  const StakeManager = await ethers.getContractFactory("StakeManager");
  const stakeManager = await StakeManager.deploy(usdcAddress, identityAddress);
  await stakeManager.waitForDeployment();
  const stakeAddress = await stakeManager.getAddress();
  console.log(">>> StakeManager deployed to:", stakeAddress);

  // Authorize deployer in ReputationRegistry
  console.log("\nConfiguring authorized recorders...");
  const authTx = await reputationRegistry.setAuthorizedRecorder(deployer.address, true);
  await authTx.wait();

  // Seed the 3 specialist agents
  console.log("\n--- Registering 3 Specialist DeFi Agents ---");
  const agents = [
    {
      name: "Smart Contract Auditor",
      skill: "contract-audit",
      endpoint: process.env.CONTRACT_AUDITOR_URL || "http://localhost:4001",
      priceUSDC: 1000n, // $0.001 USDC
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
    const regTx = await identityRegistry.registerAgent(
      a.name,
      a.skill,
      a.endpoint,
      a.priceUSDC,
      a.metadataURI
    );
    await regTx.wait();
    const agentId = BigInt(i + 1);

    try {
      const approveTx = await usdcContract.approve(stakeAddress, a.stakeAmount);
      await approveTx.wait();
      const stakeTx = await stakeManager.stake(agentId, a.stakeAmount);
      await stakeTx.wait();
      console.log(`Registered & Staked #${agentId}: ${a.name} (${Number(a.stakeAmount) / 1e6} USDC stake)`);
    } catch (err: any) {
      console.log(`Registered #${agentId}: ${a.name} (Stake skipped: ${err.message})`);
    }
  }

  // Verification read
  const allAgents = await identityRegistry.getAllAgents();
  console.log(`\nVerified Registry: ${allAgents.length} agents registered:`);
  for (const agent of allAgents) {
    const stake = await stakeManager.getStake(agent.id);
    const [avgScore, reviews] = await reputationRegistry.getReputation(agent.id);
    console.log(`-> Agent #${agent.id}: ${agent.name} [${agent.skill}] | Price: ${agent.priceUSDC} | Stake: ${Number(stake) / 1e6} USDC | Rep: ${reviews > 0 ? avgScore + "/100 (" + reviews + " reviews)" : "No reviews yet"}`);
  }

  // Save deployed addresses manifest
  const deployedAddresses = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    identityRegistry: identityAddress,
    reputationRegistry: reputationAddress,
    stakeManager: stakeAddress,
    usdc: usdcAddress,
    timestamp: new Date().toISOString(),
  };

  const deployedPath = path.resolve(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(deployedPath, JSON.stringify(deployedAddresses, null, 2));

  console.log("\n=================================================");
  console.log("DEPLOY & SEED COMPLETED SUCCESSFULLY");
  console.log("Manifest saved to:", deployedPath);
  console.log("=================================================");

  return deployedAddresses;
}

main().catch((error) => {
  console.error("Deploy & seed failed:", error);
  process.exitCode = 1;
});
