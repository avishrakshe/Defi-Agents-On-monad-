"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { faucet, getTab, openTab, solExplorer, TabState, undelegateTab, withdrawTab } from "../lib/magicblock";

const fmt = (units: number) => (units / 1e6).toFixed(3);

/**
 * Mode B on MagicBlock: the user's own prepaid Tab. Open = deposit tUSDC + delegate to the ER (one wallet signature);
 * Close = commit + undelegate on the ER, then refund the unspent balance on Solana (two signatures).
 */
export const MagicBlockTabPanel: React.FC<{ onChange?: (t: TabState | null) => void }> = ({ onChange }) => {
  const { publicKey, signTransaction } = useWallet();
  const [state, setState] = useState<TabState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; url?: string; error?: boolean } | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) return setState(null);
    try {
      const s = await getTab(publicKey.toBase58());
      setState(s);
      onChange?.(s);
    } catch (e: any) {
      setMsg({ text: e.message, error: true });
    }
  }, [publicKey, onChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!publicKey || !signTransaction) {
    return <div className="font-mono text-[12px] text-ink-2 border border-dashed border-ink/40 p-3">Connect a Solana wallet (Phantom or Solflare, devnet) to pay from your own Tab.</div>;
  }
  const owner = publicKey.toBase58();
  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    setMsg(null);
    try {
      const r = await fn();
      if (r?.signature) setMsg({ text: `${label} ✓`, url: r.explorerUrl || solExplorer(r.signature) });
      await refresh();
    } catch (e: any) {
      setMsg({ text: `${label} failed: ${e.message}`, error: true });
    } finally {
      setBusy(null);
    }
  };

  const tab = state?.tab;
  const open = !!tab?.delegated;
  return (
    <div className="border-[1.5px] border-ink bg-paper p-4 font-mono text-[12px] space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="kicker">Your Tab · MagicBlock ER</span>
        <span className="text-ink-2">
          wallet {fmt(state?.tUsdcUnits ?? 0)} tUSDC · {((state?.solLamports ?? 0) / 1e9).toFixed(3)} SOL
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="border border-ink/20 p-2">
          <div className="text-ink-3 text-[10px] uppercase">status</div>
          <div>{open ? "open on ER" : tab ? "on Solana" : "none"}</div>
        </div>
        <div className="border border-ink/20 p-2">
          <div className="text-ink-3 text-[10px] uppercase">available</div>
          <div>{tab ? fmt(tab.availableUnits) : "—"}</div>
        </div>
        <div className="border border-ink/20 p-2">
          <div className="text-ink-3 text-[10px] uppercase">calls paid</div>
          <div>{tab ? tab.nextNonce : "—"}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(state?.tUsdcUnits ?? 0) < 20_000 && !open && (
          <button disabled={!!busy} onClick={() => run("Test funds", () => faucet(owner))} className="btn-ghost btn-sm disabled:opacity-50">
            Get test tUSDC
          </button>
        )}
        {!open && !tab && (
          <button
            disabled={!!busy || (state?.tUsdcUnits ?? 0) < 20_000}
            onClick={() => run("Open tab", () => openTab(owner, 20_000, signTransaction))}
            className="btn-neon btn-sm disabled:opacity-50"
          >
            Open tab · 0.020 tUSDC
          </button>
        )}
        {open && (
          <button disabled={!!busy} onClick={() => run("Undelegate", () => undelegateTab(owner, signTransaction))} className="btn-ghost btn-sm disabled:opacity-50">
            Close tab (1/2: settle on Solana)
          </button>
        )}
        {!open && tab && (
          <button disabled={!!busy} onClick={() => run("Withdraw", () => withdrawTab(owner, signTransaction))} className="btn-ghost btn-sm disabled:opacity-50">
            Close tab (2/2: refund {fmt(tab.availableUnits)})
          </button>
        )}
        <button disabled={!!busy} onClick={refresh} className="btn-ghost btn-sm disabled:opacity-50">
          Refresh
        </button>
      </div>
      {busy && <div className="text-ink-2">{busy}… confirm in your wallet</div>}
      {msg && (
        <div className={msg.error ? "text-flame break-words" : "text-moss"}>
          {msg.text}{" "}
          {msg.url && (
            <a href={msg.url} target="_blank" rel="noreferrer" className="underline">
              ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
};
