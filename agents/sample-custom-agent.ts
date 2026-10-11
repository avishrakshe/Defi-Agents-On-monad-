import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import { callMonadRpc } from "./shared/monadRpc";
import { getLogsChunked, TRANSFER_TOPIC, decodeAbiString, ethCall } from "./shared/evm";
import { createX402Middleware } from "./shared/x402Middleware";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * Whale & Liquidity Sentinel (community agent #4)
 * Scans real Monad Testnet blocks for large native MON moves, or Transfer logs for a given token,
 * and classifies where the size is flowing (wallets vs contracts/pools).
 */

const app = express();
const PORT = process.env.CUSTOM_AGENT_PORT || 4004;
const NATIVE_BLOCKS = Number(process.env.WHALE_NATIVE_BLOCKS || 300); // ≈ 100s at ~0.33s blocks
const TOKEN_BLOCKS = Number(process.env.WHALE_TOKEN_BLOCKS || 3000); // ≈ 16 min
const MIN_MON = Number(process.env.WHALE_MIN_MON || 5);

app.use(cors());
app.use(express.json());

const x402 = createX402Middleware("whale-tracker", `http://localhost:${PORT}/api/whale`);

interface Move {
  txHash: string;
  block: number;
  from: string;
  to: string;
  amount: number;
  toContract: boolean;
}

const isContractCache = new Map<string, boolean>();
async function isContract(addr: string) {
  if (!isContractCache.has(addr)) {
    const code = await callMonadRpc("eth_getCode", [addr, "latest"]).catch(() => "0x");
    isContractCache.set(addr, !!code && code !== "0x");
  }
  return isContractCache.get(addr)!;
}

async function scanNative(): Promise<{ moves: Move[]; fromBlock: number; toBlock: number; txScanned: number }> {
  const latest = parseInt(await callMonadRpc("eth_blockNumber", []), 16);
  const fromBlock = latest - NATIVE_BLOCKS + 1;
  const moves: Move[] = [];
  let txScanned = 0;
  const numbers = Array.from({ length: NATIVE_BLOCKS }, (_, i) => fromBlock + i);

  for (let i = 0; i < numbers.length; i += 60) {
    const blocks = await Promise.allSettled(
      numbers.slice(i, i + 60).map((n) => callMonadRpc("eth_getBlockByNumber", ["0x" + n.toString(16), true]))
    );
    for (const b of blocks) {
      if (b.status !== "fulfilled" || !b.value) continue;
      for (const tx of b.value.transactions || []) {
        txScanned++;
        const amount = Number(ethers.formatEther(BigInt(tx.value || "0x0")));
        if (amount >= MIN_MON && tx.to) {
          moves.push({ txHash: tx.hash, block: parseInt(b.value.number, 16), from: tx.from, to: tx.to, amount, toContract: false });
        }
      }
    }
  }
  await Promise.all(moves.map(async (m) => (m.toContract = await isContract(m.to))));
  return { moves, fromBlock, toBlock: latest, txScanned };
}

async function scanToken(token: string) {
  const [decRaw, symRaw] = await Promise.all([ethCall(token, "0x313ce567"), ethCall(token, "0x95d89b41")]);
  const decimals = decRaw && decRaw !== "0x" ? Number(BigInt(decRaw)) : 18;
  const symbol = decodeAbiString(symRaw) || "TOKEN";
  const { logs, fromBlock, toBlock } = await getLogsChunked({ address: token, topics: [TRANSFER_TOPIC] }, TOKEN_BLOCKS);

  const all: Move[] = logs
    .filter((l) => l.topics?.length >= 3)
    .map((l) => ({
      txHash: l.transactionHash,
      block: parseInt(l.blockNumber, 16),
      from: ethers.getAddress("0x" + l.topics[1].slice(26)),
      to: ethers.getAddress("0x" + l.topics[2].slice(26)),
      amount: Number(ethers.formatUnits(l.data && l.data !== "0x" ? BigInt(l.data) : 0n, decimals)),
      toContract: false
    }));

  // "Whale" = top 5% of transfers by size in the window (at least the single largest)
  const sorted = [...all].sort((a, b) => b.amount - a.amount);
  const cutoff = sorted.length ? sorted[Math.max(0, Math.floor(sorted.length * 0.05) - 1)].amount : 0;
  const moves = sorted.filter((m) => m.amount >= cutoff && m.amount > 0).slice(0, 25);
  await Promise.all(moves.map(async (m) => (m.toContract = await isContract(m.to))));
  return { moves, all, fromBlock, toBlock, symbol };
}

app.get("/health", (req, res) => {
  res.json({ status: "online", agent: "Whale & Liquidity Sentinel", skill: "whale-tracker", port: PORT, network: "Monad Testnet 10143", timestamp: new Date().toISOString() });
});

app.post("/api/whale", x402, async (req, res) => {
  try {
    const { tokenAddress } = req.body || {};
    const useToken = typeof tokenAddress === "string" && /^0x[a-fA-F0-9]{40}$/.test(tokenAddress);

    let moves: Move[];
    let fromBlock: number;
    let toBlock: number;
    let unit = "MON";
    let activityBase = 0;
    let scannedLabel: string;

    if (useToken) {
      const r = await scanToken(ethers.getAddress(tokenAddress));
      ({ moves, fromBlock, toBlock } = r);
      unit = r.symbol;
      activityBase = r.all.length;
      scannedLabel = `${r.all.length} ${unit} transfers`;
    } else {
      const r = await scanNative();
      ({ moves, fromBlock, toBlock } = r);
      activityBase = r.txScanned;
      scannedLabel = `${r.txScanned} transactions`;
    }

    const volume = moves.reduce((s, m) => s + m.amount, 0);
    const toContracts = moves.filter((m) => m.toContract).reduce((s, m) => s + m.amount, 0);
    const uniqueWhales = new Set(moves.map((m) => m.from.toLowerCase())).size;
    const contractShare = volume ? toContracts / volume : 0;

    // Activity score: how many sizeable moves happened, damped logarithmically
    const whaleActivityScore = Math.min(100, Math.round(Math.log10(1 + moves.length) * 45 + Math.log10(1 + uniqueWhales) * 25));
    const sentiment =
      moves.length === 0
        ? "Quiet — no whale-sized moves"
        : contractShare > 0.6
        ? "Liquidity deployment — size flowing into contracts/pools"
        : contractShare < 0.3
        ? "Wallet accumulation — size flowing to EOAs"
        : "Mixed rotation between wallets and contracts";
    const liquidityHealth = activityBase > 200 ? "Deep" : activityBase > 30 ? "Moderate" : "Thin";

    const summary =
      `Whale & Liquidity: ${moves.length} large ${unit} move(s) from ${uniqueWhales} wallet(s) in blocks ${fromBlock}–${toBlock} ` +
      `(${volume.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unit}). ${sentiment}. Activity ${whaleActivityScore}/100, liquidity ${liquidityHealth.toLowerCase()} (${scannedLabel} scanned).`;

    return res.json({
      success: true,
      agent: "Whale & Liquidity Sentinel",
      skill: "whale-tracker",
      settlement: (req as any).x402Settlement,
      data: {
        network: "Monad Testnet",
        chainId: 10143,
        monitoredAsset: useToken ? `${unit} (${tokenAddress})` : "Native MON",
        fromBlock,
        toBlock,
        threshold: useToken ? "Top 5% of transfers by size" : `≥ ${MIN_MON} MON`,
        whaleActivityScore,
        sentiment,
        liquidityHealth,
        uniqueWhales,
        totalWhaleVolume: `${volume.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${unit}`,
        recentLargeTransfers: moves
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8)
          .map((m) => ({
            ...m,
            amount: `${m.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${unit}`,
            explorerUrl: `https://testnet.monadvision.com/tx/${m.txHash}`
          })),
        summary,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error("[Whale Sentinel Error]:", err);
    return res.status(500).json({ error: "Whale tracker execution failed", details: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Whale & Liquidity Sentinel] listening on port ${PORT}`);
  });
}

export default app;
