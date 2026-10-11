"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "../../components/Navbar";
import { PageBackdrop } from "../../components/PageChrome";
import { useAccount, useBalance } from "wagmi";
import { useBalances, ORCHESTRATOR_ADDRESS } from "../../lib/useBalances";

export default function WalletPage() {
  const { address, isConnected } = useAccount();
  const { data: monBalance } = useBalance({
    address,
  });

  const orchestratorAddress = ORCHESTRATOR_ADDRESS;
  const userBalances = useBalances(address ?? null);
  const orchestratorBalances = useBalances(ORCHESTRATOR_ADDRESS);
  const usdcAddress = process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3";

  return (
    <div className="relative isolate min-h-screen flex flex-col justify-between bg-[#0e0e0f] text-white overflow-x-clip">
      <PageBackdrop />
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* User Wallet Card */}
            <div className="bg-[#121214] rounded-3xl border border-white/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] p-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-white/40">
                  User Wallet (Mode B)
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  isConnected ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/30" : "bg-white/[0.06] text-white/50"
                }`}>
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>

              <div className="mb-6">
                <div className="text-sm font-mono text-white bg-white/[0.04] p-3 rounded-xl border border-white/10 mb-3 break-all">
                  {address || "Please connect your wallet in the top bar."}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/[0.04] rounded-2xl border border-white/10">
                    <span className="text-[11px] text-white/40 block mb-1">Native MON</span>
                    <span className="text-xl font-black text-white">
                      {monBalance ? `${parseFloat(monBalance.formatted).toFixed(4)} MON` : "0.00 MON"}
                    </span>
                  </div>

                  <div className="p-4 bg-white/[0.04] rounded-2xl border border-white/10">
                    <span className="text-[11px] text-white/40 block mb-1">Testnet USDC</span>
                    <span className="text-xl font-black text-white">
                      {userBalances ? `${userBalances.usdc} USDC` : "— USDC"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <a
                  href="https://faucet.monad.xyz"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-neon btn-sm w-full text-xs font-bold text-center block py-3"
                >
                  Request Native MON from Official Faucet ↗
                </a>

                <p className="text-[11px] text-white/40 text-center">
                  USDC Token Contract on Monad: <span className="font-mono">{usdcAddress}</span>
                </p>
              </div>
            </div>

            {/* Orchestrator Wallet Card */}
            <div className="bg-[#121214] rounded-3xl border border-white/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] p-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-white/40">
                  Orchestrator Autonomous Wallet (Mode A)
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/40 font-mono uppercase tracking-wider">
                  Active Operator
                </span>
              </div>

              <div className="mb-6">
                <div className="text-sm font-mono text-white bg-white/[0.04] p-3 rounded-xl border border-white/10 mb-3 break-all">
                  {orchestratorAddress}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/[0.04] rounded-2xl border border-white/10">
                    <span className="text-[11px] text-white/40 block mb-1">Orchestrator Pool</span>
                    <span className="text-xl font-black text-white">
                      {orchestratorBalances ? `${orchestratorBalances.usdc} USDC` : "— USDC"}
                    </span>
                  </div>

                  <div className="p-4 bg-white/[0.04] rounded-2xl border border-white/10">
                    <span className="text-[11px] text-white/40 block mb-1">Fee Coverage</span>
                    <span className="text-xl font-black text-emerald-300">
                      Autonomous
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/[0.04] rounded-2xl border border-white/10 text-xs text-white/60 leading-relaxed">
                In <strong>Mode A</strong>, users can run multi-agent queries instantly without signing transactions or holding testnet MON. The orchestrator autonomous wallet settles the x402 payment requirements on behalf of callers.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
