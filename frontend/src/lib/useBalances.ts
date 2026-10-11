"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { MONAD_CONTRACTS } from "./contracts";

// Operator wallet that pays specialists in Mode A and receives x402 payments (rotated after the old key leaked)
export const ORCHESTRATOR_ADDRESS = process.env.NEXT_PUBLIC_ORCHESTRATOR_ADDRESS || "0xE0754641302BB291F23E21766557Ce29c5642960";

/** Live MON + USDC balances for an address, read directly from Monad Testnet (refreshes every 30s) */
export function useBalances(address: string | null = ORCHESTRATOR_ADDRESS) {
  const [balances, setBalances] = useState<{ mon: string; usdc: string } | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const provider = new ethers.JsonRpcProvider(MONAD_CONTRACTS.rpcUrl, 10143, { staticNetwork: true });
    const usdc = new ethers.Contract(MONAD_CONTRACTS.usdc, ["function balanceOf(address) view returns (uint256)"], provider);

    const load = async () => {
      try {
        const [mon, usd] = await Promise.all([provider.getBalance(address), usdc.balanceOf(address)]);
        if (!cancelled) {
          setBalances({
            mon: Number(ethers.formatEther(mon)).toFixed(2),
            usdc: Number(ethers.formatUnits(usd, 6)).toFixed(2)
          });
        }
      } catch {
        // keep the last known value on transient RPC errors
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address]);

  return balances;
}
