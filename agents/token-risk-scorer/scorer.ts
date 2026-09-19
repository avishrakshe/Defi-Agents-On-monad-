import { callMonadRpc, getContractBytecode, executeEthCall, getTransferLogs } from "../shared/monadRpc";

export interface TokenRiskResult {
  tokenAddress: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: string;
  hasOwner: boolean;
  ownerAddress?: string;
  hasMintCapability: boolean;
  hasPauseCapability: boolean;
  hasBlacklistCapability: boolean;
  holderCountEstimate: number;
  score: number; // 0 (extreme risk) to 100 (safe)
  explanation: string;
  flags: string[];
  timestamp: string;
}

export async function scoreTokenRisk(tokenAddress: string): Promise<TokenRiskResult> {
  const flags: string[] = [];
  let score = 100;
  let hasOwner = false;
  let ownerAddress: string | undefined;
  let hasMintCapability = false;
  let hasPauseCapability = false;
  let hasBlacklistCapability = false;
  let name: string | undefined;
  let symbol: string | undefined;
  let decimals = 18;
  let totalSupply: string | undefined;

  // 1. Fetch bytecode
  const bytecode = await getContractBytecode(tokenAddress);
  if (!bytecode || bytecode === "0x" || bytecode === "0x0") {
    return {
      tokenAddress,
      hasOwner: false,
      hasMintCapability: false,
      hasPauseCapability: false,
      hasBlacklistCapability: false,
      holderCountEstimate: 0,
      score: 0,
      explanation: "Target address has no bytecode deployed on Monad Testnet (EOA or empty account).",
      flags: ["NO_BYTECODE_DEPLOYED"],
      timestamp: new Date().toISOString()
    };
  }

  // 2. Query ERC-20 Basic Info: name (0x06fdde03), symbol (0x95d89b41), decimals (0x313ce567), totalSupply (0x18160ddd)
  try {
    const symbolData = await executeEthCall(tokenAddress, "0x95d89b41");
    if (symbolData && symbolData.length >= 66) {
      // Decode hex string
      const hex = symbolData.slice(2);
      const str = Buffer.from(hex, "hex").toString("utf8").replace(/\0/g, "").trim();
      if (str) symbol = str;
    }
  } catch {}

  try {
    const nameData = await executeEthCall(tokenAddress, "0x06fdde03");
    if (nameData && nameData.length >= 66) {
      const hex = nameData.slice(2);
      const str = Buffer.from(hex, "hex").toString("utf8").replace(/\0/g, "").trim();
      if (str) name = str;
    }
  } catch {}

  try {
    const decData = await executeEthCall(tokenAddress, "0x313ce567");
    if (decData && decData !== "0x") {
      decimals = parseInt(decData, 16);
    }
  } catch {}

  try {
    const supplyData = await executeEthCall(tokenAddress, "0x18160ddd");
    if (supplyData && supplyData !== "0x") {
      totalSupply = (BigInt(supplyData) / BigInt(10 ** Math.min(decimals, 18))).toString();
    }
  } catch {}

  // 3. Inspect Ownership: owner() selector is 0x8da5cb5b
  try {
    const ownerData = await executeEthCall(tokenAddress, "0x8da5cb5b");
    if (ownerData && ownerData.length >= 66) {
      const extracted = "0x" + ownerData.slice(26, 66);
      if (extracted !== "0x0000000000000000000000000000000000000000") {
        hasOwner = true;
        ownerAddress = extracted;
        flags.push(`Active owner detected: ${extracted}`);
        score -= 10; // Slight risk deduction for centralized owner
      } else {
        flags.push("Contract ownership is renounced (0x0).");
      }
    }
  } catch {
    // Contract might not have owner() function
  }

  // 4. Inspect Bytecode for Mint/Pause/Blacklist Capabilities
  const lowerBytecode = bytecode.toLowerCase();

  // Mint function selector 40c10f19: mint(address,uint256)
  if (lowerBytecode.includes("40c10f19") || lowerBytecode.includes("a0712d68") || /mint/i.test(bytecode)) {
    hasMintCapability = true;
    flags.push("Mint function detected: Supply can be expanded by privileged roles.");
    score -= 25;
  }

  // Pause function selector 023420b9: pause() or 8456cb59: pause()
  if (lowerBytecode.includes("023420b9") || lowerBytecode.includes("8456cb59") || /pause/i.test(bytecode)) {
    hasPauseCapability = true;
    flags.push("Pause/Freeze mechanism present: Transfers can be halted by owner.");
    score -= 15;
  }

  // Blacklist / freeze address
  if (lowerBytecode.includes("blacklist") || lowerBytecode.includes("freeze") || lowerBytecode.includes("bot")) {
    hasBlacklistCapability = true;
    flags.push("Blacklist capability present: Specific user balances can be restricted.");
    score -= 20;
  }

  // 5. Transfer Event Log Analysis for Holder Concentration
  let holderCountEstimate = 1;
  try {
    const logs = await getTransferLogs(tokenAddress);
    if (logs && logs.length > 0) {
      const uniqueHolders = new Set<string>();
      for (const log of logs) {
        if (log.topics && log.topics[2]) {
          uniqueHolders.add("0x" + log.topics[2].slice(26));
        }
      }
      holderCountEstimate = Math.max(1, uniqueHolders.size);
      if (holderCountEstimate < 5) {
        flags.push(`Extreme holder concentration: only ~${holderCountEstimate} active transfer recipients detected.`);
        score -= 20;
      } else if (holderCountEstimate < 20) {
        flags.push(`Moderate holder concentration: ~${holderCountEstimate} active recipients detected.`);
        score -= 10;
      } else {
        flags.push(`Good token distribution: ~${holderCountEstimate}+ active transfer recipients found.`);
      }
    } else {
      flags.push("No recent transfer events found in indexed block window.");
      score -= 5;
    }
  } catch {
    flags.push("Transfer log query timed out or exceeded block limits.");
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Deterministic summary explanation
  let riskTier = "Low Risk";
  if (score < 40) riskTier = "High Risk / Potentially Dangerous";
  else if (score < 70) riskTier = "Medium Risk";

  const explanation = `${riskTier} (${score}/100). ${hasMintCapability ? "Minting enabled. " : ""}${hasPauseCapability ? "Pausable contract. " : ""}${hasBlacklistCapability ? "Blacklist logic present. " : ""}${hasOwner ? `Controlled by owner ${ownerAddress?.slice(0, 8)}... ` : "Ownership renounced or decentralized. "}~${holderCountEstimate} detected holders.`;

  return {
    tokenAddress,
    name: name || "Unknown Token",
    symbol: symbol || "TOKEN",
    decimals,
    totalSupply: totalSupply || "Unknown",
    hasOwner,
    ownerAddress,
    hasMintCapability,
    hasPauseCapability,
    hasBlacklistCapability,
    holderCountEstimate,
    score,
    explanation,
    flags,
    timestamp: new Date().toISOString()
  };
}
