"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";

/** Phantom / Solflare connect, styled like the rest of the masthead */
export const SolanaWalletButton: React.FC = () => {
  const { wallets, select, connect, disconnect, publicKey, connecting, wallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (publicKey) {
    const a = publicKey.toBase58();
    return (
      <button onClick={() => disconnect()} title={`${wallet?.adapter.name} · ${a} — click to disconnect`} className="btn-neon btn-sm whitespace-nowrap">
        <span>{`${a.slice(0, 4)}…${a.slice(-4)}`}</span>
      </button>
    );
  }

  const choose = async (name: string) => {
    setError(null);
    try {
      select(name as any);
      // select() is async inside the provider; give it a tick before connecting
      await new Promise((r) => setTimeout(r, 50));
      await connect();
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "Wallet connection failed");
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} disabled={connecting} className="btn-neon btn-sm whitespace-nowrap disabled:opacity-50">
        <span>{connecting ? "Connecting…" : "Connect Solana wallet"}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-paper-card border-[1.5px] border-ink shadow-hard z-[100]">
          {wallets.map((w) => {
            const installed = w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable;
            return installed ? (
              <button key={w.adapter.name} onClick={() => choose(w.adapter.name)} className="w-full flex items-center gap-3 px-4 py-3 border-b border-ink/10 last:border-b-0 hover:bg-sun-soft text-left">
                {w.adapter.icon && <img src={w.adapter.icon} alt="" className="w-5 h-5" />}
                <span className="text-[14px] font-semibold">{w.adapter.name}</span>
              </button>
            ) : (
              <a key={w.adapter.name} href={w.adapter.url} target="_blank" rel="noreferrer" className="w-full flex items-center gap-3 px-4 py-3 border-b border-ink/10 last:border-b-0 hover:bg-sun-soft">
                {w.adapter.icon && <img src={w.adapter.icon} alt="" className="w-5 h-5 opacity-50" />}
                <span className="text-[14px] text-ink-2">Install {w.adapter.name} ↗</span>
              </a>
            );
          })}
          <p className="px-4 py-2 font-mono text-[10px] text-ink-3">Set the wallet to Solana devnet.</p>
          {error && <p className="px-4 pb-2 font-mono text-[10px] text-flame">{error}</p>}
        </div>
      )}
    </div>
  );
};
