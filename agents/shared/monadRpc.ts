import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
  process.env.NEXT_PUBLIC_MONAD_RPC_FALLBACK_1 || "https://rpc.ankr.com/monad_testnet",
  process.env.NEXT_PUBLIC_MONAD_RPC_FALLBACK_2 || "https://rpc-testnet.monadinfra.com"
];

export async function callMonadRpc(method: string, params: any[] = []): Promise<any> {
  let lastError: any = null;

  for (const rpcUrl of RPC_ENDPOINTS) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Math.floor(Math.random() * 100000),
          method,
          params
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${rpcUrl}`);
      }

      const json = await response.json();
      if (json.error) {
        throw new Error(`RPC Error: ${json.error.message || JSON.stringify(json.error)}`);
      }

      return json.result;
    } catch (err: any) {
      lastError = err;
      // continue to next fallback
    }
  }

  throw new Error(`All Monad RPC endpoints failed. Last error: ${lastError?.message || "Unknown error"}`);
}

export async function getLatestGasPrice(): Promise<bigint> {
  const hex = await callMonadRpc("eth_gasPrice", []);
  return BigInt(hex);
}

export async function getFeeHistory(blockCount = 5, newestBlock = "latest", rewardPercentiles: number[] = [25, 50, 75]): Promise<any> {
  return await callMonadRpc("eth_feeHistory", [`0x${blockCount.toString(16)}`, newestBlock, rewardPercentiles]);
}

export async function getContractBytecode(address: string): Promise<string> {
  return await callMonadRpc("eth_getCode", [address, "latest"]);
}

export async function executeEthCall(to: string, data: string): Promise<string> {
  return await callMonadRpc("eth_call", [{ to, data }, "latest"]);
}

export async function getTransferLogs(tokenAddress: string, fromBlock: string = "earliest", toBlock: string = "latest"): Promise<any[]> {
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  try {
    return await callMonadRpc("eth_getLogs", [{
      address: tokenAddress,
      topics: [transferTopic],
      fromBlock,
      toBlock
    }]);
  } catch {
    // If range is too large for testnet node, fallback to recent 1000 blocks
    try {
      const currentBlockHex = await callMonadRpc("eth_blockNumber", []);
      const currentBlock = parseInt(currentBlockHex, 16);
      const recentFrom = `0x${Math.max(0, currentBlock - 1000).toString(16)}`;
      return await callMonadRpc("eth_getLogs", [{
        address: tokenAddress,
        topics: [transferTopic],
        fromBlock: recentFrom,
        toBlock: "latest"
      }]);
    } catch {
      return [];
    }
  }
}
