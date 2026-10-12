/**
 * Deploys IdentityRegistryV2 / ReputationRegistryV2 / StakeManagerV2 and seeds the four agents so that each one is
 * registered, owned, paid and staked by its own wallet.
 *
 *   npx hardhat run scripts/deploy-v2.ts --network monadTestnet
 *
 * - Owner wallets are generated once and kept in contracts/.agent-wallets.json (git-ignored); only addresses are printed.
 * - The operator funds each wallet with a little MON for gas and STAKE_USDC testnet USDC (from the operator's own
 *   faucet.circle.com balance) for its stake.
 * - No reviews are seeded: reputation starts empty.
 */
import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const WALLETS_PATH = path.resolve(__dirname, "../.agent-wallets.json");
const ADDRESSES_PATH = path.resolve(__dirname, "../deployed-addresses.json");
const BACKEND = (process.env.BACKEND_PUBLIC_URL || "https://defi-agents-backend.vercel.app").replace(/\/$/, "");
const GAS_MON = process.env.AGENT_GAS_MON || "0.5";
const STAKE_USDC = process.env.STAKE_USDC || "5";

const AGENTS = [
  {
    key: "contract-audit",
    name: "Smart Contract Auditor",
    endpoint: `${BACKEND}/agents/auditor/api/audit`,
    description: "Static security analysis of verified Monad Testnet contracts: reentrancy, unchecked calls, access control, gas.",
    dataSource: "Monad RPC eth_getCode + verified source"
  },
  {
    key: "token-risk-score",
    name: "Token Risk Scorer",
    endpoint: `${BACKEND}/agents/risk/api/score`,
    description: "Onchain inspection of ERC-20 tokens: owner privileges, mint/freeze backdoors, holder concentration.",
    dataSource: "Monad RPC eth_call + Transfer logs"
  },
  {
    key: "gas-timing",
    name: "Gas Price & Transaction Timing Agent",
    endpoint: `${BACKEND}/agents/gas/api/gas`,
    description: "Fee oracle over eth_feeHistory with measured block time and a send-now / wait recommendation.",
    dataSource: "Monad RPC eth_gasPrice + eth_feeHistory"
  },
  {
    key: "whale-tracker",
    name: "Whale & Liquidity Sentinel",
    endpoint: `${BACKEND}/agents/whale/api/whale`,
    description: "Scans recent blocks for large MON or token moves and classifies flow into wallets vs contracts.",
    dataSource: "Monad RPC blocks + Transfer logs"
  }
];

type WalletFile = Record<string, { address: string; privateKey: string }>;

function loadOrCreateWallets(): WalletFile {
  const existing: WalletFile = fs.existsSync(WALLETS_PATH) ? JSON.parse(fs.readFileSync(WALLETS_PATH, "utf8")) : {};
  for (const a of AGENTS) {
    if (!existing[a.key]) {
      const w = ethers.Wallet.createRandom();
      existing[a.key] = { address: w.address, privateKey: w.privateKey };
    }
  }
  fs.writeFileSync(WALLETS_PATH, JSON.stringify(existing, null, 2), { mode: 0o600 });
  return existing;
}

async function main() {
  const [operator] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId.toString();
  const txs: Record<string, string> = {};
  const wait = async (label: string, p: Promise<any>) => {
    const tx = await p;
    await tx.wait();
    txs[label] = tx.hash;
    console.log(`  ${label}: ${tx.hash}`);
    return tx;
  };

  console.log(`Network ${network.name} (${chainId}) — operator ${operator.address}`);
  console.log(`Operator MON: ${ethers.formatEther(await ethers.provider.getBalance(operator.address))}`);

  // USDC: Circle testnet USDC on Monad; a MockUSDC locally
  let usdcAddress = process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3";
  let usdc: any;
  if (network.name === "hardhat" || network.name === "localhost") {
    usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
  } else {
    usdc = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", usdcAddress);
  }
  const stakeUnits = ethers.parseUnits(STAKE_USDC, 6);
  const opUsdc: bigint = await usdc.balanceOf(operator.address);
  console.log(`Operator USDC: ${ethers.formatUnits(opUsdc, 6)}`);
  if (opUsdc < stakeUnits * BigInt(AGENTS.length)) {
    throw new Error(`Operator needs ${STAKE_USDC} USDC × ${AGENTS.length} for stakes; has ${ethers.formatUnits(opUsdc, 6)}`);
  }

  console.log("\n[1/4] Deploying v2 contracts");
  const identity = await (await ethers.getContractFactory("IdentityRegistryV2")).deploy();
  await identity.waitForDeployment();
  const reputation = await (await ethers.getContractFactory("ReputationRegistryV2")).deploy(await identity.getAddress());
  await reputation.waitForDeployment();
  const stake = await (await ethers.getContractFactory("StakeManagerV2")).deploy(usdcAddress, await identity.getAddress());
  await stake.waitForDeployment();
  const addr = {
    identityRegistry: await identity.getAddress(),
    reputationRegistry: await reputation.getAddress(),
    stakeManager: await stake.getAddress()
  };
  console.log(addr);
  txs.identityDeploy = identity.deploymentTransaction()!.hash;
  txs.reputationDeploy = reputation.deploymentTransaction()!.hash;
  txs.stakeDeploy = stake.deploymentTransaction()!.hash;

  const orchestrator = process.env.ORCHESTRATOR_WALLET_ADDRESS || operator.address;
  console.log(`\n[2/4] Authorizing orchestrator ${orchestrator} as recorder`);
  await wait("authorizeRecorder", reputation.setAuthorizedRecorder(orchestrator, true));

  console.log("\n[3/4] Funding agent owner wallets");
  const wallets = loadOrCreateWallets();
  for (const a of AGENTS) {
    const w = wallets[a.key];
    console.log(` ${a.key} owner/payee ${w.address}`);
    const mon = await ethers.provider.getBalance(w.address);
    if (mon < ethers.parseEther(GAS_MON) / 2n) {
      await wait(`fundMON:${a.key}`, operator.sendTransaction({ to: w.address, value: ethers.parseEther(GAS_MON) }));
    }
    const bal: bigint = await usdc.balanceOf(w.address);
    if (bal < stakeUnits) await wait(`fundUSDC:${a.key}`, usdc.connect(operator).transfer(w.address, stakeUnits - bal));
  }

  console.log("\n[4/4] Each wallet registers its own agent (payee = itself) and stakes");
  const agentIds: Record<string, number> = {};
  for (const a of AGENTS) {
    const signer = new ethers.Wallet(wallets[a.key].privateKey, ethers.provider);
    const meta = JSON.stringify({ name: a.name, skill: a.key, description: a.description, dataSource: a.dataSource, priceUSDC: "$0.001" });
    const tx = await wait(
      `register:${a.key}`,
      (identity.connect(signer) as any).registerAgent(a.name, a.key, a.endpoint, 1000n, meta, signer.address)
    );
    const rc = await ethers.provider.getTransactionReceipt(tx.hash);
    const ev = rc!.logs.map((l) => { try { return identity.interface.parseLog(l); } catch { return null; } }).find((p) => p?.name === "AgentRegistered");
    const id = Number(ev!.args.agentId);
    agentIds[a.key] = id;
    await wait(`approve:${a.key}`, (usdc.connect(signer) as any).approve(addr.stakeManager, stakeUnits));
    await wait(`stake:${a.key}`, (stake.connect(signer) as any).stake(id, stakeUnits));
  }

  console.log("\nVerification (read back from chain):");
  for (const a of await identity.getAllAgents()) {
    const s = await stake.getStake(a.id);
    const [avgAll, countAll, avgInd, countInd] = await reputation.getReputation(a.id);
    console.log(
      ` #${a.id} ${a.name} | owner ${a.owner} | payee ${a.payee} | stake ${ethers.formatUnits(s, 6)} USDC | reviews ${countAll} (independent ${countInd})`
    );
    void avgAll; void avgInd;
  }

  const previous = fs.existsSync(ADDRESSES_PATH) ? JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")) : {};
  const legacy = previous.legacyV1 || {
    identityRegistry: previous.identityRegistry,
    reputationRegistry: previous.reputationRegistry,
    stakeManager: previous.stakeManager,
    deployedAt: previous.timestamp,
    retiredBecause: "v1 agents #1-4 are owned by the leaked, retired operator key and v1 has no ownership transfer (see README Security notes)"
  };
  const out = {
    network: network.name,
    chainId,
    version: "v2",
    ...addr,
    usdc: usdcAddress,
    academyCredential: previous.academyCredential,
    orchestrator,
    agents: AGENTS.map((a) => ({
      id: agentIds[a.key],
      skill: a.key,
      name: a.name,
      owner: wallets[a.key].address,
      payee: wallets[a.key].address,
      endpoint: a.endpoint,
      stakeUSDC: STAKE_USDC
    })),
    stakeFundingNote: `Each owner wallet received ${STAKE_USDC} testnet USDC from the operator's faucet.circle.com balance and staked it itself.`,
    transactions: txs,
    timestamp: new Date().toISOString(),
    legacyV1: legacy
  };
  if (network.name !== "hardhat") fs.writeFileSync(ADDRESSES_PATH, JSON.stringify(out, null, 2));
  console.log(`\nDone.${network.name !== "hardhat" ? ` Wrote ${ADDRESSES_PATH}` : " (dry run, nothing written)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
