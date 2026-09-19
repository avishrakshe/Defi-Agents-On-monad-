"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { connectBrowserWallet, switchToMonadNetwork, MONAD_CHAIN_CONFIG } from "../lib/wallet";

interface NavbarProps {
  onOpenTaskModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenTaskModal }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const orchestratorAddress = "0x39D1...C39B";

  useEffect(() => {
    // Check if wallet is already connected
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const ethereum = (window as any).ethereum;
      ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
        }
      }).catch(() => {});

      ethereum.request({ method: "eth_chainId" }).then((hex: string) => {
        if (hex) setChainId(parseInt(hex, 16));
      }).catch(() => {});

      // Listen for account / chain changes
      const handleAccountsChanged = (accs: string[]) => {
        setAddress(accs.length > 0 ? accs[0] : null);
      };
      const handleChainChanged = (hex: string) => {
        setChainId(parseInt(hex, 16));
      };

      ethereum.on("accountsChanged", handleAccountsChanged);
      ethereum.on("chainChanged", handleChainChanged);

      return () => {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, []);

  const handleConnect = async () => {
    if (address) {
      // Disconnect local state
      setAddress(null);
      return;
    }

    try {
      setConnecting(true);
      setErrorMsg(null);
      const res = await connectBrowserWallet();
      setAddress(res.address);
      setChainId(res.chainId);
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      setErrorMsg(err.message || "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchToMonadNetwork();
      setChainId(MONAD_CHAIN_CONFIG.chainIdDecimal);
    } catch (err: any) {
      console.error("Network switch failed:", err);
    }
  };

  const formattedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;
  const isWrongNetwork = address && chainId !== MONAD_CHAIN_CONFIG.chainIdDecimal;

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
            <Link href="/learn" className="hover:text-gray-900 transition-colors">
              Academy
            </Link>
            <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
              Dashboard
            </Link>
            <Link href="/about" className="hover:text-gray-900 transition-colors">
              About
            </Link>
          </nav>
        </div>

        {/* Right: Network Status, Orchestrator Info, Connect Button */}
        <div className="flex items-center space-x-4">
          {/* Network Pill */}
          {isWrongNetwork ? (
            <button
              onClick={handleSwitchNetwork}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-medium hover:bg-amber-100 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              <span>Switch to Monad</span>
            </button>
          ) : (
            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Monad Testnet 10143</span>
            </div>
          )}

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
            {address ? (
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
            disabled={connecting}
            className="btn-monad-lime text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50"
          >
            {connecting
              ? "Connecting..."
              : address
              ? formattedAddress
              : "Connect Wallet"}
          </button>
        </div>
      </div>
    </header>
  );
};
