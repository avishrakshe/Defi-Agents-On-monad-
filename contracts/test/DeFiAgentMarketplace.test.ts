import { expect } from "chai";
import { ethers } from "hardhat";
import { IdentityRegistry, ReputationRegistry, StakeManager, MockUSDC } from "../typechain-types";

describe("DeFi Agent Marketplace Contracts", function () {
  let identityRegistry: IdentityRegistry;
  let reputationRegistry: ReputationRegistry;
  let stakeManager: StakeManager;
  let mockUSDC: MockUSDC;
  let owner: any;
  let agentOwner: any;
  let user: any;

  beforeEach(async function () {
    [owner, agentOwner, user] = await ethers.getSigners();

    // Deploy IdentityRegistry
    const IdentityFactory = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityFactory.deploy();
    await identityRegistry.waitForDeployment();

    // Deploy ReputationRegistry
    const RepFactory = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await RepFactory.deploy(await identityRegistry.getAddress());
    await reputationRegistry.waitForDeployment();

    // Deploy MockUSDC
    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await USDCFactory.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy StakeManager
    const StakeFactory = await ethers.getContractFactory("StakeManager");
    stakeManager = await StakeFactory.deploy(
      await mockUSDC.getAddress(),
      await identityRegistry.getAddress()
    );
    await stakeManager.waitForDeployment();
  });

  describe("IdentityRegistry", function () {
    it("should register an agent and retrieve its metadata", async function () {
      const tx = await identityRegistry.connect(agentOwner).registerAgent(
        "Smart Contract Auditor",
        "contract-audit",
        "http://localhost:4001",
        1000, // $0.001 USDC
        "ipfs://bafkreiauditor"
      );
      await tx.wait();

      const agent = await identityRegistry.getAgent(1);
      expect(agent.name).to.equal("Smart Contract Auditor");
      expect(agent.skill).to.equal("contract-audit");
      expect(agent.endpoint).to.equal("http://localhost:4001");
      expect(agent.priceUSDC).to.equal(1000n);
      expect(agent.owner).to.equal(agentOwner.address);
      expect(agent.active).to.be.true;

      const allAgents = await identityRegistry.getAllAgents();
      expect(allAgents.length).to.equal(1);
      expect(allAgents[0].name).to.equal("Smart Contract Auditor");
    });
  });

  describe("ReputationRegistry", function () {
    let agentId: bigint;

    beforeEach(async function () {
      const tx = await identityRegistry.connect(agentOwner).registerAgent(
        "Token Risk Scorer",
        "token-risk-score",
        "http://localhost:4002",
        1000,
        "ipfs://bafkreirisk"
      );
      await tx.wait();
      agentId = 1n;
    });

    it("should return (0, 0) and not fake score when no feedback exists", async function () {
      const [avgScore, count] = await reputationRegistry.getReputation(agentId);
      expect(avgScore).to.equal(0n);
      expect(count).to.equal(0n);
    });

    it("should reject feedback if caller has not executed a paid call", async function () {
      await expect(
        reputationRegistry.connect(user).submitFeedback(agentId, 95, "Great agent!")
      ).to.be.revertedWith("Caller has not used/paid for this agent");
    });

    it("should allow feedback after paid call is recorded and calculate avg score correctly", async function () {
      // Orchestrator / recorder records execution
      await reputationRegistry.recordPaidCall(agentId, user.address);

      await reputationRegistry.connect(user).submitFeedback(agentId, 90, "Accurate risk report");
      
      const [avgScore, count] = await reputationRegistry.getReputation(agentId);
      expect(avgScore).to.equal(90n);
      expect(count).to.equal(1n);

      // Verify cannot submit again without another paid call
      await expect(
        reputationRegistry.connect(user).submitFeedback(agentId, 80, "Double review attempt")
      ).to.be.revertedWith("Caller has not used/paid for this agent");
    });
  });

  describe("StakeManager", function () {
    let agentId: bigint;
    const stakeAmount = 50_000_000n; // 50 USDC

    beforeEach(async function () {
      await identityRegistry.connect(agentOwner).registerAgent(
        "Gas Timing Agent",
        "gas-timing",
        "http://localhost:4003",
        1000,
        "ipfs://bafkreigas"
      );
      agentId = 1n;

      // Transfer USDC to agentOwner and approve StakeManager
      await mockUSDC.transfer(agentOwner.address, stakeAmount);
      await mockUSDC.connect(agentOwner).approve(await stakeManager.getAddress(), stakeAmount);
    });

    it("should allow operator to stake testnet USDC", async function () {
      await stakeManager.connect(agentOwner).stake(agentId, stakeAmount);

      const staked = await stakeManager.getStake(agentId);
      expect(staked).to.equal(stakeAmount);
    });

    it("should allow staker to unstake", async function () {
      await stakeManager.connect(agentOwner).stake(agentId, stakeAmount);
      await stakeManager.connect(agentOwner).unstake(agentId, 20_000_000n);

      const staked = await stakeManager.getStake(agentId);
      expect(staked).to.equal(30_000_000n);
    });

    it("should allow authorized dispute resolver to slash stake", async function () {
      await stakeManager.connect(agentOwner).stake(agentId, stakeAmount);
      
      // Slashing 10 USDC
      await stakeManager.slash(agentId, 10_000_000n, user.address, "Invalid response dispute");
      
      const remaining = await stakeManager.getStake(agentId);
      expect(remaining).to.equal(40_000_000n);
      
      const userBalance = await mockUSDC.balanceOf(user.address);
      expect(userBalance).to.equal(10_000_000n);
    });
  });
});
