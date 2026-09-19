"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "../../components/Navbar";
import { useAccount, useBalance } from "wagmi";
import { monadTestnet } from "../../lib/monadChain";

export default function WalletPage() {
  const { address, isConnected } = useAccount();
  const { data: monBalance } = useBalance({
    address,
  });

  const orchestratorAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const usdcAddress = process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3";

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* User Wallet Card */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  User Wallet (Mode B)
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  isConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500"
                }`}>
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>

              <div className="mb-6">
                <div className="text-sm font-mono text-gray-900 bg-gray-50 p-3 rounded-xl border border-gray-200/80 mb-3 break-all">
                  {address || "Please connect your wallet in the top bar."}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/60">
                    <span className="text-[11px] text-gray-400 block mb-1">Native MON</span>
                    <span className="text-xl font-black text-gray-900">
                      {monBalance ? `${parseFloat(monBalance.formatted).toFixed(4)} MON` : "0.00 MON"}
                    </span>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/60">
                    <span className="text-[11px] text-gray-400 block mb-1">Testnet USDC</span>
                    <span className="text-xl font-black text-gray-900">
                      100.00 tUSDC
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <a
                  href="https://faucet.monad.xyz"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-monad-lime w-full text-xs font-bold text-center block py-3"
                >
                  Request Native MON from Official Faucet ↗
                </a>

                <p className="text-[11px] text-gray-400 text-center">
                  USDC Token Contract on Monad: <span className="font-mono">{usdcAddress}</span>
                </p>
              </div>
            </div>

            {/* Orchestrator Wallet Card */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Orchestrator Autonomous Wallet (Mode A)
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-[#f1fcc7] text-gray-900 border border-[#d6f864]">
                  Active Operator
                </span>
              </div>

              <div className="mb-6">
                <div className="text-sm font-mono text-gray-900 bg-gray-50 p-3 rounded-xl border border-gray-200/80 mb-3 break-all">
                  {orchestratorAddress}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/60">
                    <span className="text-[11px] text-gray-400 block mb-1">Orchestrator Pool</span>
                    <span className="text-xl font-black text-gray-900">
                      100.00 tUSDC
                    </span>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/60">
                    <span className="text-[11px] text-gray-400 block mb-1">Fee Coverage</span>
                    <span className="text-xl font-black text-emerald-600">
                      Autonomous
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/70 text-xs text-gray-600 leading-relaxed">
                In <strong>Mode A</strong>, users can run multi-agent queries instantly without signing transactions or holding testnet MON. The orchestrator autonomous wallet settles the x402 payment requirements on behalf of callers.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
