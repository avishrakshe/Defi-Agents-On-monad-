import { ethers } from "ethers";

export interface AgentData {
  id: number;
  name: string;
  skill: string;
  endpoint: string;
  priceUSDC: string;
  metadataURI: string;
  description: string;
  dataSource: string;
  author?: string;
  stakedUSDC: number;
  avgScore: number;
  feedbackCount: number;
  owner: string;
  active: boolean;
}

export const MONAD_CONTRACTS = {
  network: process.env.NEXT_PUBLIC_MONAD_NETWORK || "eip155:10143",
  chainId: 10143,
  rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
  usdc: process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3",
  identityRegistry: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || "0xD62b32482874E447Beb60E6Df5A21E6ebaFf54ad",
  reputationRegistry: process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0",
  stakeManager: process.env.NEXT_PUBLIC_STAKE_MANAGER_ADDRESS || "0xca1624702029E9B76c648f980a673F37758aa45a",
  explorer: "https://testnet.monadvision.com",
  faucet: "https://faucet.monad.xyz"
};

const DEFAULT_AGENTS_METADATA = [
  {
    id: 1,
    name: "Smart Contract Auditor",
    skill: "contract-audit",
    endpoint: "http://localhost:4001",
    priceUSDC: "$0.001",
    owner: "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B",
    description: "Monadscan verified source code static security analysis. Detects reentrancy, unchecked calls, authorization bypass, and gas optimizations.",
    dataSource: "Monadscan Public API + Static AST Analyzer",
    author: "Monad Security Guild"
  },
  {
    id: 2,
    name: "Token Risk Scorer",
    skill: "token-risk-score",
    endpoint: "http://localhost:4002",
    priceUSDC: "$0.001",
    owner: "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B",
    description: "Onchain inspection of ERC-20 tokens on Monad Testnet. Evaluates owner privileges, mint/freeze backdoors, and top-holder concentration.",
    dataSource: "Monad Testnet RPC eth_call & Event Logs",
    author: "Monad Risk Protocol"
  },
  {
    id: 3,
    name: "Gas Price & Transaction Timing Agent",
    skill: "gas-timing",
    endpoint: "http://localhost:4003",
    priceUSDC: "$0.001",
    owner: "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B",
    description: "Real-time fee oracle polling eth_gasPrice and eth_feeHistory. Computes congestion velocity and recommends optimal transaction submission windows.",
    dataSource: "Monad Testnet RPC eth_gasPrice & eth_feeHistory",
    author: "Monad FastPath Labs"
  }
];

export async function fetchLiveAgents(): Promise<AgentData[]> {
  try {
    const provider = new ethers.JsonRpcProvider(MONAD_CONTRACTS.rpcUrl);
    
    // Check if IdentityRegistry is deployed and callable onchain
    const identityCode = await provider.getCode(MONAD_CONTRACTS.identityRegistry).catch(() => "0x");
    const hasOnchainRegistry = identityCode && identityCode !== "0x" && identityCode !== "0x0";

    if (hasOnchainRegistry) {
      const identityAbi = [
        "function getAllAgents() external view returns (tuple(uint256 id, address owner, string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, uint256 registeredAt, bool active)[])"
      ];
      const repAbi = [
        "function getReputation(uint256 agentId) external view returns (uint256 avgScore, uint256 feedbackCount)"
      ];
      const stakeAbi = [
        "function getStake(uint256 agentId) external view returns (uint256)"
      ];

      const identityContract = new ethers.Contract(MONAD_CONTRACTS.identityRegistry, identityAbi, provider);
      const repContract = new ethers.Contract(MONAD_CONTRACTS.reputationRegistry, repAbi, provider);
      const stakeContract = new ethers.Contract(MONAD_CONTRACTS.stakeManager, stakeAbi, provider);

      const rawAgents = await identityContract.getAllAgents();

      if (rawAgents && rawAgents.length > 0) {
        const liveAgents: AgentData[] = [];
        for (const a of rawAgents) {
          const id = Number(a.id);
          let meta: any = {};
          try {
            meta = JSON.parse(a.metadataURI);
          } catch {
            meta = {};
          }

          let stake = 0;
          let avgScore = 0;
          let feedbackCount = 0;

          try {
            const stakeRaw = await stakeContract.getStake(id);
            stake = Number(stakeRaw) / 1e6;
          } catch {}

          try {
            const [avg, count] = await repContract.getReputation(id);
            avgScore = Number(avg);
            feedbackCount = Number(count);
          } catch {}

          liveAgents.push({
            id,
            name: a.name || meta.name || `Agent #${id}`,
            skill: a.skill,
            endpoint: a.endpoint,
            priceUSDC: `$${(Number(a.priceUSDC) / 1e6).toFixed(3)}`,
            metadataURI: a.metadataURI,
            description: meta.description || "Autonomous specialist DeFi agent on Monad Testnet.",
            dataSource: meta.dataSource || "Monad Testnet RPC",
            author: meta.author,
            stakedUSDC: stake,
            avgScore,
            feedbackCount,
            owner: a.owner,
            active: a.active
          });
        }
        return liveAgents;
      }
    }
  } catch (err) {
    console.warn("Falling back to verified agent manifest:", err);
  }

  return DEFAULT_AGENTS_METADATA.map((a) => ({
    id: a.id,
    name: a.name,
    skill: a.skill,
    endpoint: a.endpoint,
    priceUSDC: a.priceUSDC,
    metadataURI: JSON.stringify(a),
    description: a.description,
    dataSource: a.dataSource,
    author: a.author,
    stakedUSDC: 0,
    avgScore: 0,
    feedbackCount: 0,
    owner: a.owner,
    active: true
  }));
}
