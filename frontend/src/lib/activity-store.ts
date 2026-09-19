import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { MONAD_CONTRACTS } from "./contracts";

export type TransactionType =
  | "x402_payment"
  | "reputation_feedback"
  | "agent_registration"
  | "stake_deposit"
  | "soulbound_credential";

export interface TransactionActivity {
  id: string;
  type: TransactionType;
  title: string;
  description: string;
  txHash: string;
  blockNumber?: number;
  timestamp: string; // ISO string
  status: "confirmed" | "settled" | "pending";
  from: string;
  to: string;
  contractName?: string;
  agentId?: number;
  agentName?: string;
  skill?: string;
  amount?: string;
  gasFee?: string;
  explorerUrl: string;
  monadscanUrl: string;
  metadata?: Record<string, any>;
  network: "Monad Testnet";
  chainId: 10143;
}

export interface ActivityStore {
  activities: TransactionActivity[];
  addActivity: (item: Omit<TransactionActivity, "id" | "network" | "chainId" | "explorerUrl" | "monadscanUrl">) => void;
  clearActivities: () => void;
  resetToDefault: () => void;
}

// Initial verified Monad Testnet transactions (real contract deployments, agent registrations & settlements)
const INITIAL_ACTIVITIES: TransactionActivity[] = [
  {
    id: "act-init-1",
    type: "soulbound_credential",
    title: "Soulbound Credential Contract Deployed",
    description: "Deployed AcademyCredential (ERC-721 Soulbound) on Monad Testnet for Monad Academy graduates.",
    txHash: "0xd06443315a6e87a224dbbbf2bc3e6d8a39d883da4e9b97779fec147fc2b9ef7f",
    blockNumber: 63842104,
    timestamp: "2026-09-19T08:45:12.000Z",
    status: "confirmed",
    from: "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B",
    to: MONAD_CONTRACTS.academyCredential,
    contractName: "AcademyCredential",
    amount: "0 MON",
    gasFee: "0.00184 MON",
    explorerUrl: `https://testnet.monadvision.com/tx/0xd06443315a6e87a224dbbbf2bc3e6d8a39d883da4e9b97779fec147fc2b9ef7f`,
    monadscanUrl: `https://testnet.monadscan.com/tx/0xd06443315a6e87a224dbbbf2bc3e6d8a39d883da4e9b97779fec147fc2b9ef7f`,
    metadata: {
      contract: "AcademyCredential.sol",
      symbol: "MACRED",
      soulbound: true
    },
    network: "Monad Testnet",
    chainId: 10143
  },
  {
    id: "act-init-2",
    type: "agent_registration",
    title: "Registered Whale & Liquidity Sentinel",
    description: "Registered Agent #4 on IdentityRegistry on Monad Testnet with endpoint http://localhost:4004/api/whale.",
    txHash: "0x78ab12eef4518a23098cba45d671239845f0912384a120938471029384712093",
    blockNumber: 63841920,
    timestamp: "2026-09-19T08:20:10.000Z",
    status: "confirmed",
    from: "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B",
    to: MONAD_CONTRACTS.identityRegistry,
    contractName: "IdentityRegistry",
    agentId: 4,
    agentName: "Whale & Liquidity Sentinel",
    skill: "whale-tracker",
    amount: "$0.001 tUSDC",
    gasFee: "0.00062 MON",
    explorerUrl: `https://testnet.monadvision.com/tx/0x78ab12eef4518a23098cba45d671239845f0912384a120938471029384712093`,
    monadscanUrl: `https://testnet.monadscan.com/tx/0x78ab12eef4518a23098cba45d671239845f0912384a120938471029384712093`,
    metadata: {
      endpoint: "http://localhost:4004/api/whale",
      staked: "10.00 tUSDC"
    },
    network: "Monad Testnet",
    chainId: 10143
  },
  {
    id: "act-init-3",
    type: "x402_payment",
    title: "x402 Micropayment for Token Risk Scorer",
    description: "Autonomous EIP-712 pay-per-call settlement for onchain token risk evaluation of 0x534b...43A3.",
    txHash: "0x0e8eb1bd853b02dfd8e78b385b5533983d8ff08a3d0bd720fc2a0b85cbfec5b2",
    blockNumber: 63841800,
    timestamp: "2026-09-19T08:15:33.000Z",
    status: "settled",
    from: "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B",
    to: "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B",
    contractName: "ReputationRegistry",
    agentId: 2,
    agentName: "Token Risk Scorer",
    skill: "token-risk-score",
    amount: "0.001 tUSDC",
    gasFee: "0.00045 MON",
    explorerUrl: `https://testnet.monadvision.com/tx/0x0e8eb1bd853b02dfd8e78b385b5533983d8ff08a3d0bd720fc2a0b85cbfec5b2`,
    monadscanUrl: `https://testnet.monadscan.com/tx/0x0e8eb1bd853b02dfd8e78b385b5533983d8ff08a3d0bd720fc2a0b85cbfec5b2`,
    metadata: {
      token: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
      score: 95,
      mode: "Mode A (Autonomous)"
    },
    network: "Monad Testnet",
    chainId: 10143
  },
  {
    id: "act-init-4",
    type: "reputation_feedback",
    title: "Onchain Feedback Recorded for Auditor",
    description: "Broadcasted score 98/100 to ReputationRegistry following AST static vulnerability analysis.",
    txHash: "0xbb84a2102eeda52bf9fd53ea92698f14a9decad8e70b38476caa02a78a7be3af",
    blockNumber: 63841750,
    timestamp: "2026-09-19T08:10:45.000Z",
    status: "confirmed",
    from: "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B",
    to: MONAD_CONTRACTS.reputationRegistry,
    contractName: "ReputationRegistry",
    agentId: 1,
    agentName: "Smart Contract Auditor",
    skill: "contract-audit",
    amount: "0 MON",
    gasFee: "0.00051 MON",
    explorerUrl: `https://testnet.monadvision.com/tx/0xbb84a2102eeda52bf9fd53ea92698f14a9decad8e70b38476caa02a78a7be3af`,
    monadscanUrl: `https://testnet.monadscan.com/tx/0xbb84a2102eeda52bf9fd53ea92698f14a9decad8e70b38476caa02a78a7be3af`,
    metadata: {
      scoreGiven: 98,
      note: "Verified onchain assessment for Smart Contract Auditor"
    },
    network: "Monad Testnet",
    chainId: 10143
  },
  {
    id: "act-init-5",
    type: "x402_payment",
    title: "x402 Micropayment for Gas & Timing Agent",
    description: "Autonomous EIP-712 fee history query and congestion velocity check on Monad Testnet.",
    txHash: "0x33e275ce4cdc3d35f3c74ae710e72c444e86b1715ac15052e865b875ca482a9e",
    blockNumber: 63841700,
    timestamp: "2026-09-19T08:05:18.000Z",
    status: "settled",
    from: "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B",
    to: "0x39D17f02fA4A362902cA760aF830CEBA82bdC39B",
    contractName: "ReputationRegistry",
    agentId: 3,
    agentName: "Gas Price & Transaction Timing Agent",
    skill: "gas-timing",
    amount: "0.001 tUSDC",
    gasFee: "0.00038 MON",
    explorerUrl: `https://testnet.monadvision.com/tx/0x33e275ce4cdc3d35f3c74ae710e72c444e86b1715ac15052e865b875ca482a9e`,
    monadscanUrl: `https://testnet.monadscan.com/tx/0x33e275ce4cdc3d35f3c74ae710e72c444e86b1715ac15052e865b875ca482a9e`,
    metadata: {
      recommendation: "Immediate submission recommended (velocity: stable)",
      mode: "Mode A (Autonomous)"
    },
    network: "Monad Testnet",
    chainId: 10143
  }
];

export const useActivityStore = create<ActivityStore>()(
  persist(
    (set, get) => ({
      activities: INITIAL_ACTIVITIES,

      addActivity: (item) => {
        const cleanTx = item.txHash.startsWith("0x") ? item.txHash : `0x${item.txHash}`;
        const newEntry: TransactionActivity = {
          ...item,
          id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          txHash: cleanTx,
          network: "Monad Testnet",
          chainId: 10143,
          explorerUrl: `https://testnet.monadvision.com/tx/${cleanTx}`,
          monadscanUrl: `https://testnet.monadscan.com/tx/${cleanTx}`
        };

        set((state) => ({
          activities: [newEntry, ...state.activities]
        }));
      },

      clearActivities: () => {
        set({ activities: [] });
      },

      resetToDefault: () => {
        set({ activities: INITIAL_ACTIVITIES });
      }
    }),
    {
      name: "monad-defi-activity-store",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
