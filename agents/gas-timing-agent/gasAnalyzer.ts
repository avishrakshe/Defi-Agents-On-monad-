import { callMonadRpc, getLatestGasPrice, getFeeHistory } from "../shared/monadRpc";

export interface GasTimingResult {
  network: string;
  chainId: number;
  latestBlock: number;
  currentGasPriceGwei: number;
  currentGasPriceWei: string;
  baseFeeGwei: number;
  trend: "stable" | "rising" | "falling";
  trendPct: number;
  recommendation: string;
  urgency: "send-now" | "normal" | "wait";
  optimalMaxFeeGwei: number;
  optimalPriorityFeeGwei: number;
  priorityFeeTiersGwei: { slow: number; standard: number; fast: number };
  recentBaseFeesGwei: number[];
  blockUtilizationPct: number;
  avgBlockTimeSec: number;
  txPerBlock: number;
  congestionScore: number; // 0 (empty) to 100 (congested)
  congestionLabel: "Idle" | "Light" | "Busy" | "Congested";
  estimatedCostsMON: { transfer: number; erc20Transfer: number; swap: number };
  sampleBlocks: number;
  timestamp: string;
}

const gwei = (wei: bigint | number) => Math.round((Number(wei) / 1e9) * 1000) / 1000;
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const SAMPLE_BLOCKS = 20;
export const BLOCK_TIME_WINDOW = 200;

export interface BlockTimeSample {
  avgBlockTimeSec: number;
  latestBlock: number;
  windowBlocks: number;
  head: any;
}

/** Average block time from two real block headers `windowBlocks` apart */
export async function measureBlockTime(windowBlocks = BLOCK_TIME_WINDOW): Promise<BlockTimeSample> {
  const head = await callMonadRpc("eth_getBlockByNumber", ["latest", false]);
  const latestBlock = parseInt(head.number, 16);
  const past = await callMonadRpc("eth_getBlockByNumber", ["0x" + (latestBlock - windowBlocks).toString(16), false]);
  const avgBlockTimeSec =
    Math.round(((parseInt(head.timestamp, 16) - parseInt(past.timestamp, 16)) / windowBlocks) * 1000) / 1000;
  return { avgBlockTimeSec, latestBlock, windowBlocks, head };
}

export async function analyzeGasTiming(): Promise<GasTimingResult> {
  const [gasPriceWei, feeHistory, blockTime] = await Promise.all([
    getLatestGasPrice(),
    getFeeHistory(SAMPLE_BLOCKS, "latest", [10, 50, 90]).catch(() => null),
    measureBlockTime()
  ]);
  const { latestBlock, avgBlockTimeSec, head } = blockTime;
  const txPerBlock = head.transactions?.length ?? 0;

  // Base fee trend: compare the newer half of the window with the older half
  const baseFees: number[] = feeHistory?.baseFeePerGas?.map((h: string) => gwei(BigInt(h))) ?? [gwei(gasPriceWei)];
  const half = Math.max(1, Math.floor(baseFees.length / 2));
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const older = avg(baseFees.slice(0, half));
  const newer = avg(baseFees.slice(half));
  const trendPct = Math.round(((newer - older) / (older || 1)) * 1000) / 10;
  const trend: GasTimingResult["trend"] = trendPct > 5 ? "rising" : trendPct < -5 ? "falling" : "stable";

  // Utilisation straight from gasUsedRatio
  const ratios: number[] = feeHistory?.gasUsedRatio ?? [];
  const blockUtilizationPct = Math.round(avg(ratios) * 10000) / 100;
  const congestionScore = Math.min(100, Math.round(blockUtilizationPct * 1.25 + (trend === "rising" ? 10 : 0)));
  const congestionLabel = congestionScore < 15 ? "Idle" : congestionScore < 45 ? "Light" : congestionScore < 75 ? "Busy" : "Congested";

  // Priority fee tiers: median of each percentile column across sampled blocks
  const rewards: string[][] = feeHistory?.reward ?? [];
  const col = (i: number) => median(rewards.map((r) => gwei(BigInt(r[i] ?? "0x0"))));
  const priorityFeeTiersGwei = { slow: col(0), standard: col(1), fast: col(2) };

  const baseFeeGwei = baseFees[baseFees.length - 1];
  const currentGasPriceGwei = gwei(gasPriceWei);
  const optimalPriorityFeeGwei = priorityFeeTiersGwei.standard || Math.max(0.001, Math.round(currentGasPriceGwei * 0.1 * 1000) / 1000);
  const optimalMaxFeeGwei = Math.round((baseFeeGwei * 2 + optimalPriorityFeeGwei) * 1000) / 1000;

  // Monad charges gas_limit × price, so these use typical gas limits
  const cost = (gasLimit: number) => Math.round(((gasLimit * Number(gasPriceWei)) / 1e18) * 1e7) / 1e7;
  const estimatedCostsMON = { transfer: cost(21000), erc20Transfer: cost(65000), swap: cost(180000) };

  let urgency: GasTimingResult["urgency"] = "normal";
  let recommendation: string;
  if (congestionLabel === "Congested" || (trend === "rising" && congestionScore >= 45)) {
    urgency = "wait";
    recommendation = `Network is ${congestionLabel.toLowerCase()} (${blockUtilizationPct}% block utilisation) and base fee is ${trend} ${trendPct}%. Delay non-urgent transactions ~10–20 blocks (≈${Math.round(avgBlockTimeSec * 15)}s); use a ${priorityFeeTiersGwei.fast} gwei tip if it must land now.`;
  } else if (trend === "falling" || congestionLabel === "Idle") {
    urgency = "send-now";
    recommendation = `Optimal window: blocks are ${blockUtilizationPct}% full and base fee is ${trend}. Submit now — a ${optimalPriorityFeeGwei} gwei tip lands in the next block (~${avgBlockTimeSec}s). A token transfer costs ≈${estimatedCostsMON.erc20Transfer} MON.`;
  } else {
    recommendation = `Fees are steady (${trend} ${trendPct}%) with ${blockUtilizationPct}% utilisation. Standard tip ${optimalPriorityFeeGwei} gwei; expect inclusion within 1–2 blocks (~${avgBlockTimeSec}s each).`;
  }

  return {
    network: "Monad Testnet",
    chainId: 10143,
    latestBlock,
    currentGasPriceGwei,
    currentGasPriceWei: gasPriceWei.toString(),
    baseFeeGwei,
    trend,
    trendPct,
    recommendation,
    urgency,
    optimalMaxFeeGwei,
    optimalPriorityFeeGwei,
    priorityFeeTiersGwei,
    recentBaseFeesGwei: baseFees,
    blockUtilizationPct,
    avgBlockTimeSec,
    txPerBlock,
    congestionScore,
    congestionLabel,
    estimatedCostsMON,
    sampleBlocks: ratios.length,
    timestamp: new Date().toISOString()
  };
}
