/**
 * CLI Tool: Check Agent Onchain Reputation on Monad Testnet
 * Usage: node check-reputation.js [agentId]
 */

const { ethers } = require("ethers");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const REP_ADDRESS = process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0";
const IDENTITY_ADDRESS = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const REP_ABI = [
  "function getReputation(uint256 agentId) external view returns (uint256 avgScore, uint256 feedbackCount)"
];

const IDENTITY_ABI = [
  "function getAgent(uint256 agentId) external view returns (tuple(uint256 id, string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, address owner, bool active))"
];

async function checkReputation() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const repContract = new ethers.Contract(REP_ADDRESS, REP_ABI, provider);
  const identityContract = new ethers.Contract(IDENTITY_ADDRESS, IDENTITY_ABI, provider);

  const targetId = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  const agentIds = targetId ? [targetId] : [1, 2, 3];

  console.log("\n=======================================================");
  console.log("   Monad Testnet Onchain Agent Reputation Inspector");
  console.log("=======================================================");
  console.log(`RPC:                ${RPC_URL}`);
  console.log(`ReputationRegistry: ${REP_ADDRESS}`);
  console.log("-------------------------------------------------------\n");

  for (const id of agentIds) {
    try {
      let agentName = `Agent #${id}`;
      let skill = "Specialist";

      try {
        const agentData = await identityContract.getAgent(id);
        if (agentData && agentData.name) {
          agentName = agentData.name;
          skill = agentData.skill;
        }
      } catch (_) {}

      const [avg, count] = await repContract.getReputation(id);
      const scoreNum = Number(avg);
      const countNum = Number(count);

      console.log(`[Agent ID ${id}] ${agentName} (${skill})`);
      console.log(`  * Average Score:  ${countNum > 0 ? `${scoreNum}/100` : "No ratings yet"}`);
      console.log(`  * Feedback Count: ${countNum} verified onchain review${countNum === 1 ? "" : "s"}`);
      console.log(`  * Explorer:       https://testnet.monadvision.com/address/${REP_ADDRESS}\n`);
    } catch (err) {
      console.error(`[Agent ID ${id}] Error reading reputation:`, err.message);
    }
  }
}

checkReputation().catch(console.error);
