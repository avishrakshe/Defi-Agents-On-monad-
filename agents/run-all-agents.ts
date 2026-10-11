import auditorApp from "./contract-auditor/index";
import riskApp from "./token-risk-scorer/index";
import gasApp from "./gas-timing-agent/index";
import whaleApp from "./sample-custom-agent";

const AUDITOR_PORT = process.env.CONTRACT_AUDITOR_PORT || 4001;
const RISK_PORT = process.env.TOKEN_RISK_PORT || 4002;
const GAS_PORT = process.env.GAS_TIMING_PORT || 4003;
const WHALE_PORT = process.env.CUSTOM_AGENT_PORT || 4004;

console.log("=================================================");
console.log("Starting 4 Specialist DeFi Agents for Monad Testnet");
console.log("=================================================");

auditorApp.listen(AUDITOR_PORT, () => {
  console.log(`[Agent 1] Smart Contract Auditor running on http://localhost:${AUDITOR_PORT}`);
});

riskApp.listen(RISK_PORT, () => {
  console.log(`[Agent 2] Token Risk Scorer running on http://localhost:${RISK_PORT}`);
});

gasApp.listen(GAS_PORT, () => {
  console.log(`[Agent 3] Gas Price & Timing Agent running on http://localhost:${GAS_PORT}`);
});

// Agent 4 is registered onchain at http://localhost:4004/api/whale
whaleApp.listen(WHALE_PORT, () => {
  console.log(`[Agent 4] Whale & Liquidity Sentinel running on http://localhost:${WHALE_PORT}`);
});
