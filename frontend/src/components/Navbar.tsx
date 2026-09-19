"use client";

import React from "react";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";

interface NavbarProps {
  onOpenTaskModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenTaskModal }) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const orchestratorAddress = "0x7099...79C8";
  const formattedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;

  const handleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      const conn = connectors[0];
      if (conn) {
        connect({ connector: conn });
      }
    }
  };

  return (
    <header className="sticky top-4 z-50 w-full px-4 sm:px-8 max-w-7xl mx-auto">
      <div className="bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.04)] px-5 py-3 flex items-center justify-between transition-all">
        {/* Left: Brand & Nav Links */}
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-full bg-[#ccff00] flex items-center justify-center font-black text-black text-base shadow-sm group-hover:scale-105 transition-transform">
              D
            </div>
            <span className="font-bold text-lg text-gray-900 tracking-tight">DeFi Agents</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-gray-600">
            <Link href="/#registry" className="hover:text-gray-900 transition-colors">
              Registry
            </Link>
            <Link href="/activity" className="hover:text-gray-900 transition-colors">
              Activity
            </Link>
            <Link href="/wallet" className="hover:text-gray-900 transition-colors">
              Wallet
            </Link>
            <Link href="/about" className="hover:text-gray-900 transition-colors">
              About
            </Link>
          </nav>
        </div>

        {/* Right: Network Status, Orchestrator Info, Connect Button */}
        <div className="flex items-center space-x-4">
          {/* Network Pill */}
          <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Monad Testnet 10143</span>
          </div>

          {/* Orchestrator Wallet Status */}
          <div className="hidden xl:flex flex-col text-right border-l border-gray-200 pl-4 text-xs">
            <div className="text-gray-400 flex items-center justify-end space-x-1">
              <span>Orchestrator</span>
              <span className="font-mono text-gray-600 font-semibold">{orchestratorAddress}</span>
            </div>
            <div className="flex items-center justify-end space-x-1.5">
              <span className="text-gray-700 font-semibold">100.00 tUSDC</span>
              <a
                href="https://faucet.monad.xyz"
                target="_blank"
                rel="noreferrer"
                className="text-[#65a30d] hover:underline font-medium"
              >
                Top up faucet
              </a>
            </div>
          </div>

          {/* Connection Status Indicator */}
          <div className="hidden sm:flex flex-col text-right text-xs">
            {isConnected ? (
              <>
                <span className="text-emerald-600 font-medium flex items-center justify-end space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Connected</span>
                </span>
                <span className="font-mono text-gray-500">{formattedAddress}</span>
              </>
            ) : (
              <>
                <span className="text-gray-500 font-medium">Not connected</span>
                <span className="text-gray-400">Connect for Mode B</span>
              </>
            )}
          </div>

          {/* Connect Wallet Button */}
          <button
            onClick={handleConnect}
            className="btn-monad-lime text-xs sm:text-sm font-bold shadow-sm"
          >
            {isConnected ? formattedAddress : "Connect Wallet"}
          </button>
        </div>
      </div>
    </header>
  );
};
