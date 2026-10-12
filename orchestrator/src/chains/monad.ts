import { ethers } from "ethers";
import { ChainAdapter, ChainAgent } from "./types";
import { decomposeTask } from "../router";
import { executeSubtask } from "../executor";
import { getOrchestratorWallet, getProvider } from "../x402Client";
import { listRegistryAgents, reputationAddress, REPUTATION_V2_ABI, stakeManagerAddress } from "../../../agents/shared/registry";

const EXPLORER = () => process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://testnet.monadvision.com";

/** Part A: Monad testnet — IdentityRegistryV2 / ReputationRegistryV2 / StakeManagerV2, x402 EIP-3009 */
export const monadChain: ChainAdapter = {
  id: "monad",

  async listAgents(): Promise<ChainAgent[]> {
    const rep = new ethers.Contract(reputationAddress(), REPUTATION_V2_ABI, getProvider());
    const stake = new ethers.Contract(stakeManagerAddress(), ["function getStake(uint256) view returns (uint256)"], getProvider());
    return Promise.all(
      (await listRegistryAgents()).map(async (a) => {
        const [r, op, st] = await Promise.all([
          rep.getReputation(a.id).catch(() => null),
          rep.getOperatorReputation(a.id).catch(() => null),
          stake.getStake(a.id).catch(() => null)
        ]);
        return {
          id: a.id,
          name: a.name,
          skill: a.skill,
          endpoint: a.endpoint,
          owner: a.owner,
          payee: a.payee,
          priceUnits: a.priceUnits.toString(),
          active: a.active,
          stakeUnits: st === null ? null : st.toString(),
          independent: r ? { avg: Number(r[2]), count: Number(r[3]) } : { avg: 0, count: 0 },
          operator: op ? { avg: Number(op[0]), count: Number(op[1]) } : { avg: 0, count: 0 },
          paidCalls: null,
          metadataURI: a.metadataURI
        };
      })
    );
  },

  async getReputation(agentId) {
    const rep = new ethers.Contract(reputationAddress(), REPUTATION_V2_ABI, getProvider());
    const [[, , avgInd, countInd], [avgOp, countOp]] = await Promise.all([rep.getReputation(agentId), rep.getOperatorReputation(agentId)]);
    return { independent: { avg: Number(avgInd), count: Number(countInd) }, operator: { avg: Number(avgOp), count: Number(countOp) } };
  },

  decompose: (taskText) => decomposeTask(taskText),

  payForCall: (subtask, opts = {}) => executeSubtask({ subtask, mode: opts.mode, authorization: opts.authorization }),

  async submitFeedback({ agentId, callId }, score, note) {
    const wallet = getOrchestratorWallet();
    if (!wallet) throw new Error("ORCHESTRATOR_PRIVATE_KEY is not configured");
    const rep = new ethers.Contract(reputationAddress(), REPUTATION_V2_ABI, wallet);
    const tx = await rep.submitFeedbackFor(agentId, callId, Math.min(100, Math.max(0, Math.round(score))), String(note).slice(0, 280));
    const receipt = await tx.wait();
    return {
      kind: "Operator",
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `${EXPLORER()}/tx/${tx.hash}`,
      reputation: { agentId, ...(await monadChain.getReputation(agentId)) }
    };
  },

  // Every Monad call settles on its own block; there is nothing to batch.
  checkpoint: async () => ({ chain: "monad", note: "Monad settles each call in its own transaction; no checkpoint needed" })
};
