import { ethers } from "ethers";
import { Subtask } from "./router";
import { getOrchestratorWallet, signPaymentAuthorization } from "./x402Client";
import { listRegistryAgents, reputationAddress, REPUTATION_V2_ABI } from "../../agents/shared/registry";

export interface StepSettlement {
  /** x402 receipt returned by the specialist (real USDC transfer when settled) */
  payment: any;
  paymentTxHash?: string;
  /** The agent's payee, taken from the 402 response and checked against IdentityRegistryV2 */
  payee?: string;
  /** Random bytes32 identifying this paid call in ReputationRegistryV2 — present only when it was recorded */
  callId?: string;
  /** ReputationRegistryV2.recordPaidCall transaction written by the orchestrator */
  recordTxHash?: string;
  recordBlockNumber?: number;
  recordError?: string;
  /** Back-compat: the most relevant onchain hash for this step */
  txHash?: string;
  blockNumber?: number;
  explorerUrl?: string;
}

export interface StepResult {
  subtask: Subtask;
  settlement: StepSettlement;
  result: any;
  durationMs: number;
}

export interface PaymentQuote {
  payTo: string;
  amountUnits: string;
  agentId?: number;
  asset: string;
  network: string;
}

const EXPLORER = () => process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://testnet.monadvision.com";
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 30000);
/** Upper bound the orchestrator will ever pay per call in Mode A, whatever an agent's 402 asks for */
const MAX_PRICE_UNITS = BigInt(process.env.MAX_PRICE_UNITS || "10000");

export function requestBodyFor(subtask: Subtask) {
  switch (subtask.skill) {
    case "token-risk-score":
      return { tokenAddress: subtask.tokenAddress };
    case "contract-audit":
      return { contractAddress: subtask.contractAddress };
    case "gas-timing":
      return { network: "monad-testnet" };
    default:
      return { tokenAddress: subtask.tokenAddress, contractAddress: subtask.contractAddress, network: "monad-testnet" };
  }
}

/** Step 1 of x402: call the agent without payment and read what its 402 asks for */
export async function quotePayment(subtask: Subtask): Promise<PaymentQuote> {
  const res = await fetch(subtask.targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBodyFor(subtask)),
    signal: AbortSignal.timeout(AGENT_TIMEOUT_MS)
  });
  const json: any = await res.json().catch(() => ({}));
  if (res.status !== 402) throw new Error(`${subtask.agentName}: expected HTTP 402 payment requirements, got ${res.status}`);
  const req = json?.x402?.accepts?.[0];
  if (!req?.payTo || !req?.maxAmountRequired) throw new Error(`${subtask.agentName}: 402 response has no payment requirements`);
  return { payTo: ethers.getAddress(req.payTo), amountUnits: String(req.maxAmountRequired), agentId: req.extra?.agentId, asset: req.asset, network: req.network };
}

/** The quote must name this agent's registered payee — an endpoint can't redirect payments elsewhere */
async function checkQuote(subtask: Subtask, quote: PaymentQuote) {
  const agent = (await listRegistryAgents()).find((a) => a.id === subtask.agentId);
  if (!agent) throw new Error(`Agent #${subtask.agentId} is not in IdentityRegistryV2`);
  if (agent.payee.toLowerCase() !== quote.payTo.toLowerCase()) {
    throw new Error(`${subtask.agentName}: 402 payTo ${quote.payTo} is not the registered payee ${agent.payee}`);
  }
  if (BigInt(quote.amountUnits) > MAX_PRICE_UNITS) throw new Error(`${subtask.agentName}: asks ${quote.amountUnits} units, above MAX_PRICE_UNITS`);
}

/**
 * Executes one specialist call end-to-end:
 *  Mode A — 402 probe → orchestrator signs EIP-3009 to the agent's payee → paid retry → recordPaidCall(callId)
 *  Mode B — the browser already did the 402 probe and signed; we forward the authorization → recordPaidCall(callId)
 * A paid call is recorded only when the USDC transfer actually settled.
 */
export async function executeSubtask(opts: { subtask: Subtask; mode?: "A" | "B"; authorization?: any }): Promise<StepResult> {
  const { subtask, mode = "A", authorization } = opts;
  const started = Date.now();
  const wallet = getOrchestratorWallet();

  let paymentHeader: string;
  let payee: string | undefined;
  if (mode === "B") {
    if (!authorization) throw new Error("Mode B requires a signed authorization");
    paymentHeader = typeof authorization === "string" ? authorization : JSON.stringify(authorization);
    payee = typeof authorization === "object" ? authorization.to : undefined;
  } else {
    if (!wallet) throw new Error("Orchestrator wallet is not configured (ORCHESTRATOR_PRIVATE_KEY)");
    const quote = await quotePayment(subtask);
    await checkQuote(subtask, quote);
    payee = quote.payTo;
    paymentHeader = JSON.stringify(await signPaymentAuthorization(wallet, quote.payTo, quote.amountUnits));
  }

  const res = await fetch(subtask.targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Payment-Authorization": paymentHeader },
    body: JSON.stringify(requestBodyFor(subtask)),
    signal: AbortSignal.timeout(AGENT_TIMEOUT_MS)
  });

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = json?.reason || json?.details || json?.error || res.statusText;
    throw new Error(`${subtask.agentName} responded HTTP ${res.status}: ${why}`);
  }

  const payment = json.settlement || null;
  const settlement: StepSettlement = { payment, payee: payment?.payTo || payee, paymentTxHash: payment?.settled ? payment.txHash : undefined };

  if (wallet && payment?.settled) {
    try {
      const rep = new ethers.Contract(reputationAddress(), REPUTATION_V2_ABI, wallet);
      const callId = ethers.hexlify(ethers.randomBytes(32));
      // The client is the verified signer of the settled payment, never a caller-supplied address
      const tx = await rep.recordPaidCall(subtask.agentId, payment.from, callId);
      const receipt = await tx.wait();
      Object.assign(settlement, { callId, recordTxHash: tx.hash, recordBlockNumber: receipt?.blockNumber });
    } catch (err: any) {
      settlement.recordError = err.shortMessage || err.message;
      console.warn(`[executor] recordPaidCall for agent ${subtask.agentId} failed:`, settlement.recordError);
    }
  }

  settlement.txHash = settlement.paymentTxHash || settlement.recordTxHash;
  settlement.blockNumber = payment?.settled ? payment.blockNumber : settlement.recordBlockNumber;
  settlement.explorerUrl = settlement.txHash ? `${EXPLORER()}/tx/${settlement.txHash}` : undefined;

  return { subtask, settlement, result: json.data, durationMs: Date.now() - started };
}

/** Maps a specialist result into the synthesizer's structured slots */
export function slotFor(skill: string) {
  return skill === "token-risk-score" ? "riskScore" : skill === "gas-timing" ? "gasTiming" : skill === "contract-audit" ? "audit" : skill;
}
