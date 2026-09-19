export const IdentityRegistryABI = [
  "function registerAgent(string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI) external returns (uint256)",
  "function updateAgent(uint256 agentId, string endpoint, uint256 priceUSDC, string metadataURI, bool active) external",
  "function getAgent(uint256 agentId) external view returns (tuple(uint256 id, address owner, string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, uint256 registeredAt, bool active))",
  "function getAllAgents() external view returns (tuple(uint256 id, address owner, string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI, uint256 registeredAt, bool active)[])",
  "function getAgentCount() external view returns (uint256)",
  "function isAgentActive(uint256 agentId) external view returns (bool)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string skill, string name, uint256 priceUSDC, string endpoint, string metadataURI)"
];

export const ReputationRegistryABI = [
  "function recordPaidCall(uint256 agentId, address client) external",
  "function submitFeedback(uint256 agentId, uint8 score, string note) external",
  "function submitFeedbackFor(uint256 agentId, address reviewer, uint8 score, string note) external",
  "function getReputation(uint256 agentId) external view returns (uint256 avgScore, uint256 feedbackCount)",
  "function getFeedbacks(uint256 agentId) external view returns (tuple(address reviewer, uint8 score, string note, uint256 timestamp)[])",
  "event FeedbackSubmitted(uint256 indexed agentId, address indexed reviewer, uint8 score, string note, uint256 timestamp)"
];

export const StakeManagerABI = [
  "function stake(uint256 agentId, uint256 amount) external",
  "function unstake(uint256 agentId, uint256 amount) external",
  "function getStake(uint256 agentId) external view returns (uint256)",
  "function slash(uint256 agentId, uint256 amount, address recipient, string reason) external",
  "event Staked(uint256 indexed agentId, address indexed staker, uint256 amount, uint256 totalStake)",
  "event Unstaked(uint256 indexed agentId, address indexed staker, uint256 amount, uint256 remainingStake)",
  "event Slashed(uint256 indexed agentId, uint256 amount, address indexed recipient, string reason)"
];

export const ERC20ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];
