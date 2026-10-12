import { expect } from "chai";
import { ethers } from "hardhat";
import { IdentityRegistryV2, ReputationRegistryV2, StakeManagerV2, MockUSDC } from "../typechain-types";

const callId = (s: string) => ethers.id(s);
const CLIENT = 0n;
const OPERATOR = 1n;

describe("V2 contracts", function () {
  let identity: IdentityRegistryV2;
  let reputation: ReputationRegistryV2;
  let stake: StakeManagerV2;
  let usdc: MockUSDC;
  let deployer: any, operator: any, agentOwner: any, payee: any, client: any, stranger: any, newOwner: any;

  beforeEach(async function () {
    [deployer, operator, agentOwner, payee, client, stranger, newOwner] = await ethers.getSigners();
    identity = await (await ethers.getContractFactory("IdentityRegistryV2")).deploy();
    reputation = await (await ethers.getContractFactory("ReputationRegistryV2")).deploy(await identity.getAddress());
    usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    stake = await (await ethers.getContractFactory("StakeManagerV2")).deploy(await usdc.getAddress(), await identity.getAddress());
    await reputation.setAuthorizedRecorder(operator.address, true);
    await identity.connect(agentOwner).registerAgent("Auditor", "contract-audit", "https://a.example/api", 1000, "{}", payee.address);
  });

  describe("IdentityRegistryV2", function () {
    it("stores owner and payee at registration and emits AgentRegistered", async function () {
      const a = await identity.getAgent(1);
      expect(a.owner).to.equal(agentOwner.address);
      expect(a.payee).to.equal(payee.address);
      expect(a.active).to.be.true;
      expect(await identity.payeeOf(1)).to.equal(payee.address);
      expect(await identity.agentOwnerOf(1)).to.equal(agentOwner.address);
      expect(await identity.getAgentCount()).to.equal(1n);
      await expect(identity.connect(stranger).registerAgent("X", "x", "https://x", 1, "", stranger.address))
        .to.emit(identity, "AgentRegistered")
        .withArgs(2, stranger.address, stranger.address, "x", "X", 1, "https://x", "");
    });

    it("rejects a zero payee", async function () {
      await expect(identity.registerAgent("X", "x", "https://x", 1, "", ethers.ZeroAddress)).to.be.revertedWith("Payee required");
    });

    it("lets the agent owner update endpoint, price and metadata", async function () {
      await expect(identity.connect(agentOwner).updateAgent(1, "https://b.example/api", 2000, "meta"))
        .to.emit(identity, "AgentUpdated")
        .withArgs(1, "https://b.example/api", 2000, "meta");
      const a = await identity.getAgent(1);
      expect(a.endpoint).to.equal("https://b.example/api");
      expect(a.priceUSDC).to.equal(2000n);
    });

    it("blocks non-owners — including the registry owner — from updateAgent and setPayee", async function () {
      await expect(identity.connect(stranger).updateAgent(1, "https://evil", 0, "")).to.be.revertedWith("Not agent owner");
      await expect(identity.connect(deployer).updateAgent(1, "https://evil", 0, "")).to.be.revertedWith("Not agent owner");
      await expect(identity.connect(stranger).setPayee(1, stranger.address)).to.be.revertedWith("Not agent owner");
      await expect(identity.connect(deployer).setPayee(1, deployer.address)).to.be.revertedWith("Not agent owner");
    });

    it("lets the agent owner change the payee", async function () {
      await expect(identity.connect(agentOwner).setPayee(1, client.address))
        .to.emit(identity, "AgentPayeeUpdated")
        .withArgs(1, payee.address, client.address);
      expect(await identity.payeeOf(1)).to.equal(client.address);
      await expect(identity.connect(agentOwner).setPayee(1, ethers.ZeroAddress)).to.be.revertedWith("Payee required");
    });

    it("transfers agent ownership; the old owner loses control", async function () {
      await expect(identity.connect(stranger).transferAgentOwnership(1, stranger.address)).to.be.revertedWith("Not agent owner");
      await expect(identity.connect(agentOwner).transferAgentOwnership(1, ethers.ZeroAddress)).to.be.revertedWith("New owner required");
      await expect(identity.connect(agentOwner).transferAgentOwnership(1, newOwner.address))
        .to.emit(identity, "AgentOwnershipTransferred")
        .withArgs(1, agentOwner.address, newOwner.address);
      expect((await identity.getAgent(1)).owner).to.equal(newOwner.address);
      await expect(identity.connect(agentOwner).updateAgent(1, "https://old", 1, "")).to.be.revertedWith("Not agent owner");
      await identity.connect(newOwner).updateAgent(1, "https://new", 1, "");
      expect((await identity.getAgent(1)).endpoint).to.equal("https://new");
    });

    it("setActive: agent owner or registry owner (emergency) only", async function () {
      await expect(identity.connect(stranger).setActive(1, false)).to.be.revertedWith("Not agent owner or registry owner");
      await expect(identity.connect(deployer).setActive(1, false)).to.emit(identity, "AgentActiveSet").withArgs(1, false, deployer.address);
      expect(await identity.isAgentActive(1)).to.be.false;
      await identity.connect(agentOwner).setActive(1, true);
      expect(await identity.isAgentActive(1)).to.be.true;
    });

    it("reverts on unknown agents", async function () {
      await expect(identity.getAgent(99)).to.be.revertedWith("Agent does not exist");
      await expect(identity.connect(agentOwner).updateAgent(99, "x", 1, "")).to.be.revertedWith("Agent does not exist");
      await expect(identity.setActive(99, true)).to.be.revertedWith("Agent does not exist");
    });
  });

  describe("ReputationRegistryV2", function () {
    it("does not emit RecorderAuthorized on every recordPaidCall", async function () {
      await expect(reputation.connect(operator).recordPaidCall(1, client.address, callId("c1")))
        .to.emit(reputation, "PaidCallRecorded")
        .withArgs(1, client.address, callId("c1"))
        .and.not.to.emit(reputation, "RecorderAuthorized");
      const c = await reputation.getCall(callId("c1"));
      expect(c.client).to.equal(client.address);
      expect(c.reviewed).to.be.false;
      expect(await reputation.paidCallCount(1)).to.equal(1n);
    });

    it("only authorized recorders can record, callIds are unique, agent must be active", async function () {
      await expect(reputation.connect(stranger).recordPaidCall(1, client.address, callId("c1"))).to.be.revertedWith(
        "Not authorized to record paid calls"
      );
      await reputation.connect(operator).recordPaidCall(1, client.address, callId("c1"));
      await expect(reputation.connect(operator).recordPaidCall(1, client.address, callId("c1"))).to.be.revertedWith("callId already recorded");
      await expect(reputation.connect(operator).recordPaidCall(1, client.address, ethers.ZeroHash)).to.be.revertedWith("callId required");
      await identity.connect(agentOwner).setActive(1, false);
      await expect(reputation.connect(operator).recordPaidCall(1, client.address, callId("c2"))).to.be.revertedWith("Agent is not active");
    });

    it("client review is stored as Client and counts as independent", async function () {
      await reputation.connect(operator).recordPaidCall(1, client.address, callId("c1"));
      await expect(reputation.connect(client).submitFeedback(1, callId("c1"), 80, "good"))
        .to.emit(reputation, "FeedbackSubmitted")
        .withArgs(1, client.address, callId("c1"), CLIENT, 80, "good");
      const [avgAll, countAll, avgInd, countInd] = await reputation.getReputation(1);
      expect([avgAll, countAll, avgInd, countInd]).to.deep.equal([80n, 1n, 80n, 1n]);
      const fb = await reputation.getFeedbacks(1);
      expect(fb[0].kind).to.equal(CLIENT);
      expect(fb[0].callId).to.equal(callId("c1"));
    });

    it("rejects feedback without a paid call", async function () {
      await expect(reputation.connect(client).submitFeedback(1, callId("nope"), 80, "")).to.be.revertedWith("No paid call for this callId");
    });

    it("rejects duplicate feedback on the same call", async function () {
      await reputation.connect(operator).recordPaidCall(1, client.address, callId("c1"));
      await reputation.connect(client).submitFeedback(1, callId("c1"), 80, "");
      await expect(reputation.connect(client).submitFeedback(1, callId("c1"), 10, "")).to.be.revertedWith("Call already reviewed");
    });

    it("rejects feedback from a wallet that did not pay for the call, or for the wrong agent", async function () {
      await identity.connect(agentOwner).registerAgent("Other", "x", "https://x", 1, "", payee.address);
      await reputation.connect(operator).recordPaidCall(1, client.address, callId("c1"));
      await expect(reputation.connect(stranger).submitFeedback(1, callId("c1"), 80, "")).to.be.revertedWith("Caller did not pay for this call");
      await expect(reputation.connect(client).submitFeedback(2, callId("c1"), 80, "")).to.be.revertedWith("callId belongs to another agent");
    });

    it("rejects scores above 100", async function () {
      await reputation.connect(operator).recordPaidCall(1, client.address, callId("c1"));
      await expect(reputation.connect(client).submitFeedback(1, callId("c1"), 101, "")).to.be.revertedWith("Score must be 0-100");
    });

    it("agent owner / payee cannot self-review as Client", async function () {
      await reputation.connect(operator).recordPaidCall(1, agentOwner.address, callId("o1"));
      await reputation.connect(operator).recordPaidCall(1, payee.address, callId("p1"));
      await expect(reputation.connect(agentOwner).submitFeedback(1, callId("o1"), 100, "")).to.be.revertedWith("Agent cannot review itself");
      await expect(reputation.connect(payee).submitFeedback(1, callId("p1"), 100, "")).to.be.revertedWith("Agent cannot review itself");
    });

    it("operator reviews its own paid calls as Operator, never as Client", async function () {
      await reputation.connect(operator).recordPaidCall(1, operator.address, callId("m1"));
      await expect(reputation.connect(operator).submitFeedback(1, callId("m1"), 90, "")).to.be.revertedWith(
        "Operators must use submitFeedbackFor"
      );
      await expect(reputation.connect(operator).submitFeedbackFor(1, callId("m1"), 90, "mode A"))
        .to.emit(reputation, "FeedbackSubmitted")
        .withArgs(1, operator.address, callId("m1"), OPERATOR, 90, "mode A");
      const [avgAll, countAll, avgInd, countInd] = await reputation.getReputation(1);
      expect([avgAll, countAll, avgInd, countInd]).to.deep.equal([90n, 1n, 0n, 0n]);
      expect(await reputation.getOperatorReputation(1)).to.deep.equal([90n, 1n]);
    });

    it("operator cannot review (and so burn) a call a client paid for", async function () {
      await reputation.connect(operator).recordPaidCall(1, client.address, callId("c1"));
      await expect(reputation.connect(operator).submitFeedbackFor(1, callId("c1"), 0, "")).to.be.revertedWith("Not an operator-paid call");
      await expect(reputation.connect(stranger).submitFeedbackFor(1, callId("c1"), 0, "")).to.be.revertedWith(
        "Not authorized to record paid calls"
      );
    });

    it("splits independent and operator averages", async function () {
      await reputation.connect(operator).recordPaidCall(1, client.address, callId("c1"));
      await reputation.connect(operator).recordPaidCall(1, operator.address, callId("m1"));
      await reputation.connect(client).submitFeedback(1, callId("c1"), 60, "");
      await reputation.connect(operator).submitFeedbackFor(1, callId("m1"), 100, "");
      const [avgAll, countAll, avgInd, countInd] = await reputation.getReputation(1);
      expect([avgAll, countAll, avgInd, countInd]).to.deep.equal([80n, 2n, 60n, 1n]);
      expect(await reputation.getOperatorReputation(1)).to.deep.equal([100n, 1n]);
    });

    it("only the owner can authorize recorders", async function () {
      await expect(reputation.connect(stranger).setAuthorizedRecorder(stranger.address, true)).to.be.reverted;
      await expect(reputation.setAuthorizedRecorder(ethers.ZeroAddress, true)).to.be.revertedWith("Zero address");
      await expect(reputation.setAuthorizedRecorder(stranger.address, true)).to.emit(reputation, "RecorderAuthorized").withArgs(stranger.address, true);
    });
  });

  describe("StakeManagerV2", function () {
    beforeEach(async function () {
      await usdc.mint(agentOwner.address, 10_000_000n);
      await usdc.connect(agentOwner).approve(await stake.getAddress(), 10_000_000n);
    });

    it("stakes, unstakes and reports balances against IdentityRegistryV2", async function () {
      await expect(stake.connect(agentOwner).stake(1, 5_000_000n)).to.emit(stake, "Staked").withArgs(1, agentOwner.address, 5_000_000n, 5_000_000n);
      expect(await stake.getStake(1)).to.equal(5_000_000n);
      expect(await stake.getStakerBalance(1, agentOwner.address)).to.equal(5_000_000n);
      await stake.connect(agentOwner).unstake(1, 2_000_000n);
      expect(await stake.getStake(1)).to.equal(3_000_000n);
      await expect(stake.connect(stranger).unstake(1, 1n)).to.be.revertedWith("Insufficient staked balance");
    });

    it("rejects stake on unknown or inactive agents and zero amounts", async function () {
      await expect(stake.connect(agentOwner).stake(1, 0)).to.be.revertedWith("Stake amount must be > 0");
      await expect(stake.connect(agentOwner).stake(99, 1)).to.be.revertedWith("Agent does not exist");
      await identity.connect(agentOwner).setActive(1, false);
      await expect(stake.connect(agentOwner).stake(1, 1)).to.be.revertedWith("Agent not active");
    });

    it("slash is restricted to the dispute resolver or owner", async function () {
      await stake.connect(agentOwner).stake(1, 5_000_000n);
      await expect(stake.connect(stranger).slash(1, 1n, stranger.address, "x")).to.be.revertedWith("Caller is not authorized dispute resolver");
      await stake.setDisputeResolver(operator.address);
      await expect(stake.connect(operator).slash(1, 1_000_000n, client.address, "bad output"))
        .to.emit(stake, "Slashed")
        .withArgs(1, 1_000_000n, client.address, "bad output");
      expect(await stake.getStake(1)).to.equal(4_000_000n);
      expect(await usdc.balanceOf(client.address)).to.equal(1_000_000n);
    });
  });
});
