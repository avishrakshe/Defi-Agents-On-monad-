import { Subtask } from "./router";
import { OrchestratorResults, buildSummary, polishSummary } from "./synthesizer";
import { ethers } from "ethers";

export interface ExecutionStep {
  subtask: Subtask;
  status: "pending" | "paid" | "completed" | "failed";
  settlement?: any;
  result?: any;
  durationMs: number;
  error?: string;
}

export interface OrchestrationResult {
  mode: "Mode A: Autonomous (Orchestrator Pays)" | "Mode B: Your Wallet";
  taskText: string;
  subtasks: Subtask[];
  steps: ExecutionStep[];
  results: OrchestratorResults;
  summary: string;
  polished: boolean;
  totalCostUSDC: string;
  timestamp: string;
}

const SKILL_TO_AGENT_ID: Record<string, number> = {
  "contract-audit": 1,
  "token-risk-score": 2,
  "gas-timing": 3
};

export async function executeModeA(taskText: string, subtasks: Subtask[]): Promise<OrchestrationResult> {
  const rawKey = process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  const privateKey = rawKey && rawKey !== "[PRIVATE_KEY]" ? (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) : undefined;
  const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let signerWallet: ethers.Wallet | null = null;
  if (privateKey) {
    try {
      signerWallet = new ethers.Wallet(privateKey, provider);
    } catch (e) {
      console.warn("Could not instantiate wallet from private key:", e);
    }
  }

  const orchestratorAddress = signerWallet?.address || "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B";
  const payTo = process.env.PAY_TO_ADDRESS || orchestratorAddress;
  const asset = process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3";
  const repAddress = process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS || "0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0";

  const repAbi = [
    "function recordPaidCall(uint256 agentId, address client) external"
  ];
  const repContract = signerWallet ? new ethers.Contract(repAddress, repAbi, signerWallet) : null;

  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: 10143,
    verifyingContract: asset
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ]
  };

  const steps: ExecutionStep[] = [];
  const results: OrchestratorResults = {};

  for (const subtask of subtasks) {
    const startTime = Date.now();
    const step: ExecutionStep = {
      subtask,
      status: "pending",
      durationMs: 0
    };

    try {
      const now = Math.floor(Date.now() / 1000);
      const validAfter = now - 60;
      const validBefore = now + 3600;
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const value = "1000"; // 0.001 USDC

      let signature = "";
      if (signerWallet) {
        const message = {
          from: orchestratorAddress,
          to: payTo,
          value,
          validAfter,
          validBefore,
          nonce
        };
        signature = await signerWallet.signTypedData(domain, types, message);
      }

      const paymentAuth = JSON.stringify({
        scheme: "exact",
        network: "eip155:10143",
        from: orchestratorAddress,
        to: payTo,
        value,
        validAfter,
        validBefore,
        nonce,
        signature
      });

      let requestBody: any = {};
      if (subtask.skill === "token-risk-score") {
        requestBody = { tokenAddress: subtask.tokenAddress };
      } else if (subtask.skill === "contract-audit") {
        requestBody = { contractAddress: subtask.contractAddress };
      } else if (subtask.skill === "gas-timing") {
        requestBody = { network: "monad-testnet" };
      }

      const res = await fetch(subtask.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payment-Authorization": paymentAuth
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(12000)
      });

      step.durationMs = Date.now() - startTime;

      if (!res.ok) {
        throw new Error(`Specialist agent HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      step.status = "completed";

      // Broadcast real onchain transaction to Monad Testnet for this agent call!
      let onchainTxHash = json.settlement?.txHash;
      let blockNumber: number | undefined;

      if (repContract) {
        try {
          const agentId = SKILL_TO_AGENT_ID[subtask.skill] || 1;
          const tx = await repContract.recordPaidCall(agentId, orchestratorAddress);
          onchainTxHash = tx.hash;
          const receipt = await tx.wait();
          blockNumber = receipt.blockNumber;
        } catch (onchainErr: any) {
          console.warn("[Orchestrator] Onchain recordPaidCall broadcast notice:", onchainErr.message);
        }
      }

      step.settlement = {
        ...json.settlement,
        txHash: onchainTxHash,
        blockNumber,
        explorerUrl: `https://testnet.monadvision.com/tx/${onchainTxHash}`
      };
      step.result = json.data;

      // Map into structured results
      if (subtask.skill === "token-risk-score") {
        results.riskScore = json.data;
      } else if (subtask.skill === "gas-timing") {
        results.gasTiming = json.data;
      } else if (subtask.skill === "contract-audit") {
        results.audit = json.data;
      }
    } catch (err: any) {
      step.status = "failed";
      step.error = err.message;
      step.durationMs = Date.now() - startTime;
      console.error(`[Orchestrator] Error executing ${subtask.skill}:`, err.message);
    }

    steps.push(step);
  }

  // Synthesis
  const deterministicSummary = buildSummary(results);
  const { summary, polished } = await polishSummary(deterministicSummary);

  return {
    mode: "Mode A: Autonomous (Orchestrator Pays)",
    taskText,
    subtasks,
    steps,
    results,
    summary,
    polished,
    totalCostUSDC: `$${(subtasks.length * 0.001).toFixed(3)}`,
    timestamp: new Date().toISOString()
  };
}
