"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Network = "monad" | "magicblock";

const KEY = "agentmarket.network";
const DEFAULT: Network = process.env.NEXT_PUBLIC_DEFAULT_CHAIN === "magicblock" ? "magicblock" : "monad";

const NetworkContext = createContext<{ network: Network; setNetwork: (n: Network) => void }>({ network: DEFAULT, setNetwork: () => {} });

/** Which rail the UI talks to. Persisted per viewer; storage can be unavailable, so every access is guarded. */
export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setState] = useState<Network>(DEFAULT);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "monad" || saved === "magicblock") setState(saved);
    } catch {}
  }, []);

  const setNetwork = (n: Network) => {
    setState(n);
    try {
      window.localStorage.setItem(KEY, n);
    } catch {}
  };

  return <NetworkContext.Provider value={{ network, setNetwork }}>{children}</NetworkContext.Provider>;
}

export const useNetwork = () => useContext(NetworkContext);
