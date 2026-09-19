import auditorApp from "./contract-auditor/index";
import riskApp from "./token-risk-scorer/index";
import gasApp from "./gas-timing-agent/index";

const AUDITOR_PORT = process.env.CONTRACT_AUDITOR_PORT || 4001;
const RISK_PORT = process.env.TOKEN_RISK_PORT || 4002;
const GAS_PORT = process.env.GAS_TIMING_PORT || 4003;

console.log("=================================================");
console.log("Starting 3 Specialist DeFi Agents for Monad Testnet");
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
