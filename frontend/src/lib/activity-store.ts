import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
  mergeActivities: (items: TransactionActivity[]) => void;
  clearActivities: () => void;
  resetToDefault: () => void;
}

export const useActivityStore = create<ActivityStore>()(
  persist(
    (set) => ({
      // Starts empty: the Activity page fills it with real contract events read from Monad Testnet,
      // and the Command Deck appends each transaction it sends.
      activities: [],

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

      mergeActivities: (items) => {
        set((state) => {
          // Dedupe by tx hash + type: local entries carry richer context, so keep them when both exist
          const seen = new Set(state.activities.map((a) => `${a.txHash.toLowerCase()}|${a.type}`));
          const fresh = items.filter((a) => !seen.has(`${a.txHash.toLowerCase()}|${a.type}`));
          const merged = [...state.activities, ...fresh].sort(
            (x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime()
          );
          return { activities: merged.slice(0, 300) };
        });
      },

      clearActivities: () => {
        set({ activities: [] });
      },

      resetToDefault: () => {
        set({ activities: [] });
      }
    }),
    {
      name: "monad-defi-activity-store",
      version: 3,
      // v1 shipped hard-coded sample entries (some with hashes that never existed) and the old console marked
      // every x402 call "settled" even when no USDC moved — drop the samples and downgrade unproven settlements
      migrate: (persisted: any) => ({
        ...persisted,
        activities: (persisted?.activities || [])
          .filter((a: TransactionActivity) => !a.id?.startsWith("act-init-"))
          .map((a: TransactionActivity) =>
            a.type === "x402_payment" && a.status === "settled" && !a.metadata?.paymentTxHash
              ? { ...a, status: "confirmed", amount: "0 USDC (unsettled)" }
              : a
          )
      }),
      storage: createJSONStorage(() => localStorage)
    }
  )
);