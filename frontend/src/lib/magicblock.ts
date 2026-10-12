"use client";

import { useEffect, useState } from "react";
import { Buffer } from "buffer";
import { Transaction } from "@solana/web3.js";
import { getOrchestratorUrl } from "./orchestrator";
import type { AgentData } from "./contracts";

/** Base-layer RPC for the browser wallet (reads only; every write goes through /api/magicblock/relay) */
export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const solExplorer = (sigOrAddr: string, kind: "tx" | "address" = "tx") => `https://explorer.solana.com/${kind}/${sigOrAddr}?cluster=devnet`;

const api = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${getOrchestratorUrl()}${path}`, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.details || json.error || `HTTP ${res.status}`);
  return json;
};
const post = (path: string, body: unknown) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** agent_market agents on Solana devnet (via the backend, which decodes the program accounts) */
export async function fetchMagicblockAgents(): Promise<AgentData[]> {
  const { agents } = await api("/api/agents?chain=magicblock");
  return (agents as any[])
    .filter((a) => a.active)
    .map((a) => {
      let meta: any = {};
      try {
        meta = JSON.parse(a.metadataURI || "{}");
      } catch {}
      return {
        id: a.id,
        name: a.name,
        skill: a.skill,
        endpoint: a.endpoint,
        priceUSDC: `$${(Number(a.priceUnits) / 1e6).toFixed(3)}`,
        metadataURI: a.metadataURI,
        description: meta.description || "",
        dataSource: meta.rail || "MagicBlock ER",
        stakedUSDC: a.stakeUnits === null ? null : Number(a.stakeUnits) / 1e6,
        owner: a.owner,
        payee: a.payee,
        active: a.active,
        independent: a.independent,
        operator: a.operator,
        paidCalls: a.paidCalls,
        source: "chain" as const
      };
    });
}

export interface MagicblockMetrics {
  programId: string;
  erRpc: string;
  validator: string;
  erConfirm: { n: number; medianMs: number | null; minMs: number | null; maxMs: number | null; note: string };
  feePerErTxLamports: number | null;
  ledger: { callsSinceCheckpoint: number; totalCalls: number; checkpoints: number; lastCheckpointAt: string | null; checkpointEveryCalls: number; checkpointEverySecs: number };
  callsPerCommit: number | null;
  totalPaidOutUnits: number;
  payouts: { agentId: number; skill: string; payee: string; paidTotalUnits: number; payouts: number; lastPayoutSignature?: string; lastPayoutExplorerUrl?: string; lastPayoutAt?: string }[];
  lastCommit: { signature: string; explorerUrl: string; at: string | null } | null;
  lastCheckpoint: { erSignature: string; erExplorerUrl: string; commitSignature?: string; commitExplorerUrl?: string; at: string } | null;
}

/** Live /api/magicblock/metrics, polled. null while loading or on error — callers render "—". */
export function useMagicblockMetrics(enabled = true, pollMs = 10_000): MagicblockMetrics | null {
  const [m, setM] = useState<MagicblockMetrics | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      api("/api/magicblock/metrics")
        .then((x) => alive && setM(x))
        .catch(() => alive && setM(null));
    load();
    const id = setInterval(load, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [enabled, pollMs]);
  return m;
}

export const getMetrics = (): Promise<MagicblockMetrics> => api("/api/magicblock/metrics");

export interface TabState {
  owner: string;
  tab: null | { address: string; delegated: boolean; depositedUnits: number; spentUnits: number; availableUnits: number; nextNonce: number; openReceipts: number };
  tUsdcUnits: number;
  solLamports: number;
  mint: string;
}
export const getTab = (owner: string): Promise<TabState> => api(`/api/tab/${owner}`);
export const faucet = (owner: string) => post("/api/magicblock/faucet", { owner });

type Signer = (tx: Transaction) => Promise<Transaction>;

/** Sign a server-built transaction in the wallet and broadcast it through the backend relay */
export async function signAndRelay(built: { tx: string; layer: "er" | "base" }, signTransaction: Signer) {
  const signed = await signTransaction(Transaction.from(Buffer.from(built.tx, "base64")));
  return post("/api/magicblock/relay", { layer: built.layer, tx: signed.serialize().toString("base64") });
}

export const openTab = async (owner: string, amountUnits: number, sign: Signer) => signAndRelay(await post("/api/tab/open", { owner, amountUnits }), sign);
export const undelegateTab = async (owner: string, sign: Signer) => signAndRelay(await post("/api/tab/close", { owner, step: "undelegate" }), sign);
export const withdrawTab = async (owner: string, sign: Signer) => signAndRelay(await post("/api/tab/close", { owner, step: "withdraw" }), sign);

/** Mode B: the wallet signs one pay_for_call bound to this exact request; returned base64 goes in X-Payment */
export async function signPayForCall(client: string, agentId: number, targetUrl: string, body: unknown, sign: Signer) {
  const built = await post("/api/magicblock/pay-tx", { client, agentId, method: "POST", path: new URL(targetUrl).pathname, body });
  const signed = await sign(Transaction.from(Buffer.from(built.tx, "base64")));
  return { authorization: signed.serialize().toString("base64"), callId: built.callId as string, receiptPda: built.receiptPda as string };
}

/** Independent review of a call the wallet paid for */
export async function submitMagicblockFeedback(reviewer: string, agentId: number, callId: string, score: number, sign: Signer) {
  return signAndRelay(await post("/api/magicblock/feedback-tx", { reviewer, agentId, callId, score }), sign);
}
