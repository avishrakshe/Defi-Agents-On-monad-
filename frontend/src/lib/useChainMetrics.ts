"use client";

import { useEffect, useState } from "react";
import { getOrchestratorUrl } from "./orchestrator";

export interface ChainMetrics {
  chainId: number;
  avgBlockTimeSec: number;
  avgBlockTimeMs: number;
  windowBlocks: number;
  latestBlock: number;
  measuredAt: string;
}

/**
 * Live block time measured by the backend (/api/chain-metrics, 200-block average, 30s cache).
 * Returns null while loading or on error; callers render "—" and never a made-up fallback.
 */
export function useChainMetrics(refreshMs = 30_000): ChainMetrics | null {
  const [metrics, setMetrics] = useState<ChainMetrics | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${getOrchestratorUrl()}/api/chain-metrics`, { signal: AbortSignal.timeout(15_000) })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((m: ChainMetrics) => {
          if (alive && typeof m.avgBlockTimeSec === "number") setMetrics(m);
        })
        .catch(() => alive && setMetrics(null));
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [refreshMs]);

  return metrics;
}

/** "305 ms" — the API's own avgBlockTimeMs, unrounded further — or "—" when there's no measurement */
export const formatBlockTime = (m: ChainMetrics | null) => (m ? `${m.avgBlockTimeMs} ms` : "—");
