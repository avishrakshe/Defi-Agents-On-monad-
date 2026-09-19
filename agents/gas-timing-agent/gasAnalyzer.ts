import { getLatestGasPrice, getFeeHistory } from "../shared/monadRpc";

export interface GasTimingResult {
  network: string;
  chainId: number;
  currentGasPriceGwei: number;
  currentGasPriceWei: string;
  trend: "stable" | "rising" | "falling";
  recommendation: string;
  optimalMaxFeeGwei: number;
  optimalPriorityFeeGwei: number;
  recentBaseFeesGwei: number[];
  congestionScore: number; // 0 (empty) to 100 (congested)
  timestamp: string;
}

export async function analyzeGasTiming(): Promise<GasTimingResult> {
  const gasPriceWei = await getLatestGasPrice();
  const gasPriceGwei = Number(gasPriceWei) / 1e9;

  let recentBaseFeesGwei: number[] = [];
  let trend: "stable" | "rising" | "falling" = "stable";
  let congestionScore = 20;

  try {
    const feeHistory = await getFeeHistory(5, "latest", [25, 50, 75]);
    if (feeHistory && feeHistory.baseFeePerGas && feeHistory.baseFeePerGas.length > 1) {
      recentBaseFeesGwei = feeHistory.baseFeePerGas.map((hex: string) =>
        Math.round((Number(BigInt(hex)) / 1e9) * 100) / 100
      );

      const firstFee = recentBaseFeesGwei[0];
      const lastFee = recentBaseFeesGwei[recentBaseFeesGwei.length - 1];
      const diffPercent = ((lastFee - firstFee) / (firstFee || 1)) * 100;

      if (diffPercent > 8) {
        trend = "rising";
        congestionScore = 65;
      } else if (diffPercent < -8) {
        trend = "falling";
        congestionScore = 25;
      } else {
        trend = "stable";
        congestionScore = 40;
      }
    }
  } catch {
    // If feeHistory isn't available, rely on gasPrice
    recentBaseFeesGwei = [gasPriceGwei, gasPriceGwei];
  }

  // Recommendation engine
  let recommendation = "";
  if (trend === "falling") {
    recommendation = "Optimal window: Gas fees are decreasing. Great time to execute transactions immediately.";
  } else if (trend === "rising") {
    recommendation = "Congestion picking up. Submit high-priority transactions now, or delay non-urgent actions for 5-10 blocks.";
  } else {
    recommendation = "Fees are steady. Monad 1-second block times ensure swift sub-cent transaction finality.";
  }

  const optimalPriorityFeeGwei = Math.max(0.1, Math.round((gasPriceGwei * 0.1) * 100) / 100);
  const optimalMaxFeeGwei = Math.round((gasPriceGwei * 1.2) * 100) / 100;

  return {
    network: "Monad Testnet",
    chainId: 10143,
    currentGasPriceGwei: Math.round(gasPriceGwei * 100) / 100,
    currentGasPriceWei: gasPriceWei.toString(),
    trend,
    recommendation,
    optimalMaxFeeGwei,
    optimalPriorityFeeGwei,
    recentBaseFeesGwei,
    congestionScore,
    timestamp: new Date().toISOString()
  };
}
