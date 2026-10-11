import { ethers } from "ethers";
import { Subtask } from "./router";
import { getOrchestratorWallet, signPaymentAuthorization } from "./x402Client";

export interface StepSettlement {
  /** x402 receipt returned by the specialist (real USDC transfer when settled) */
  payment: any;
  paymentTxHash?: string;
  /** ReputationRegistry.recordPaidCall transaction written by the orchestrator */
  recordTxHash?: string;
  recordBlockNumber?: number;
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

const EXPLORER = () => process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://testnet.monadvision.com";
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 30000);

function requestBodyFor(subtask: Subtask) {
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

/**
 * Executes one specialist call end-to-end:
 * sign (Mode A) or forward (Mode B) an EIP-3009 authorization → call the agent → record the paid call onchain.
 */
export async function executeSubtask(opts: {
  subtask: Subtask;
  mode?: "A" | "B";
  authorization?: any;
  clientAddress?: string;
}): Promise<StepResult> {
  const { subtask, mode = "A", authorization } = opts;
  const started = Date.now();
  const wallet = getOrchestratorWallet();
  const payTo = process.env.PAY_TO_ADDRESS || wallet?.address;

  let paymentHeader: string;
  if (mode === "B" && authorization) {
    paymentHeader = typeof authorization === "string" ? authorization : JSON.stringify(authorization);
  } else {
    if (!wallet || !payTo) throw new Error("Orchestrator wallet is not configured (ORCHESTRATOR_PRIVATE_KEY)");
    paymentHeader = JSON.stringify(await signPaymentAuthorization(wallet, payTo));
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
  const settlement: StepSettlement = { payment, paymentTxHash: payment?.settled ? payment.txHash : undefined };

  if (wallet) {
    try {
      const rep = new ethers.Contract(
        process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0",
        ["function recordPaidCall(uint256 agentId, address client) external"],
        wallet
      );
      const client = opts.clientAddress || payment?.from || authorization?.from || wallet.address;
      const tx = await rep.recordPaidCall(subtask.agentId, client);
      const receipt = await tx.wait();
      settlement.recordTxHash = tx.hash;
      settlement.recordBlockNumber = receipt?.blockNumber;
    } catch (err: any) {
      console.warn(`[executor] recordPaidCall for agent ${subtask.agentId} failed:`, err.shortMessage || err.message);
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
