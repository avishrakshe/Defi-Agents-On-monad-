import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=================================================");
  console.log("Deploying DeFi Agent Marketplace Contracts");
  console.log("Network:", network.name, "(Chain ID:", (await ethers.provider.getNetwork()).chainId, ")");
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
  let mockUSDC = null;

  if (network.name === "hardhat" || network.name === "localhost") {
    console.log("\nDeploying MockUSDC for local environment...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    usdcAddress = await mockUSDC.getAddress();
    console.log(">>> MockUSDC deployed to:", usdcAddress);
  }

  console.log("\n[3/3] Deploying StakeManager with USDC:", usdcAddress);
  const StakeManager = await ethers.getContractFactory("StakeManager");
  const stakeManager = await StakeManager.deploy(usdcAddress, identityAddress);
  await stakeManager.waitForDeployment();
  const stakeAddress = await stakeManager.getAddress();
  console.log(">>> StakeManager deployed to:", stakeAddress);

  // Authorize deployer and orchestrator in ReputationRegistry
  console.log("\nConfiguring authorized recorders...");
  const authTx = await reputationRegistry.setAuthorizedRecorder(deployer.address, true);
  await authTx.wait();
  console.log(">>> Deployer authorized in ReputationRegistry");

  // Output summary and update .env
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
  console.log(`\nSaved contract deployment manifest to: ${deployedPath}`);

  console.log("\n=================================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("IdentityRegistry  :", identityAddress);
  console.log("ReputationRegistry:", reputationAddress);
  console.log("StakeManager      :", stakeAddress);
  console.log("USDC Token        :", usdcAddress);
  console.log("Explorer URL      : https://testnet.monadvision.com/address/" + identityAddress);
  console.log("=================================================");

  return deployedAddresses;
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
