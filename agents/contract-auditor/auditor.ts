import { getContractBytecode } from "../shared/monadRpc";

export interface AuditResult {
  contractAddress: string;
  sourceVerified: boolean;
  compilerVersion?: string;
  contractName?: string;
  criticalIssues: string[];
  mediumIssues: string[];
  gasOptimizations: string[];
  timestamp: string;
}

export async function auditContract(contractAddress: string): Promise<AuditResult> {
  const criticalIssues: string[] = [];
  const mediumIssues: string[] = [];
  const gasOptimizations: string[] = [];
  let sourceVerified = false;
  let compilerVersion: string | undefined;
  let contractName: string | undefined;
  let sourceCode = "";

  // 1. Attempt to fetch verified source code from Monadscan API
  try {
    const scanUrl = `${process.env.NEXT_PUBLIC_MONAD_SCAN_URL || "https://testnet.monadscan.com"}/api?module=contract&action=getsourcecode&address=${contractAddress}`;
    const res = await fetch(scanUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      if (data.status === "1" && data.result && data.result.length > 0) {
        const item = data.result[0];
        if (item.SourceCode && item.SourceCode.trim().length > 0) {
          sourceVerified = true;
          sourceCode = item.SourceCode;
          compilerVersion = item.CompilerVersion;
          contractName = item.ContractName;
        }
      }
    }
  } catch {
    // Monadscan API may be unreachable; proceed to bytecode / static fallback
  }

  // 2. Fetch real onchain bytecode from Monad RPC
  const bytecode = await getContractBytecode(contractAddress);
  if (!bytecode || bytecode === "0x" || bytecode === "0x0") {
    criticalIssues.push("Address is an EOA or has no deployed runtime bytecode on Monad Testnet.");
    return {
      contractAddress,
      sourceVerified: false,
      criticalIssues,
      mediumIssues,
      gasOptimizations,
      timestamp: new Date().toISOString()
    };
  }

  // 3. Static Analysis on Source Code (if verified)
  if (sourceVerified && sourceCode) {
    // Critical: tx.origin authorization check
    if (/tx\.origin\s*==/i.test(sourceCode) || /require\s*\([^)]*tx\.origin/i.test(sourceCode)) {
      criticalIssues.push("Vulnerable authorization: 'tx.origin' detected for access control instead of msg.sender.");
    }

    // Critical: delegatecall to variable
    if (/\.delegatecall\s*\(/i.test(sourceCode) && !/Address\.functionDelegateCall/i.test(sourceCode)) {
      criticalIssues.push("Potential proxy hijack: Unrestricted or dynamic 'delegatecall' instruction identified.");
    }

    // Critical: reentrancy without guard
    if (/\.call\s*\{value:/i.test(sourceCode) && !/nonReentrant|ReentrancyGuard/i.test(sourceCode)) {
      criticalIssues.push("High reentrancy risk: State update or external value transfer without ReentrancyGuard detected.");
    }

    // Medium: unchecked low level call
    if (/\.call\s*\(/.test(sourceCode) && !/\(bool\s+\w+,\s*\)/.test(sourceCode)) {
      mediumIssues.push("Unchecked low-level call: Return boolean of .call(...) is not explicitly verified.");
    }

    // Medium: block.timestamp dependence
    if (/now|block\.timestamp/i.test(sourceCode) && /winner|random|roll/i.test(sourceCode)) {
      mediumIssues.push("Weak randomness: 'block.timestamp' used in lottery/winning computation.");
    }

    // Medium: missing zero-address check on ownership transfer
    if (/function\s+transferOwnership\s*\(\s*address\s+\w+\s*\)/.test(sourceCode) && !/require\(\w+\s*!=\s*address\(0\)/.test(sourceCode)) {
      mediumIssues.push("Missing zero-address validation: transferOwnership lacks address(0) sanitize guard.");
    }

    // Gas: loops with storage length
    if (/for\s*\([^;]+;\s*\w+\s*<\s*\w+\.length\s*;/i.test(sourceCode)) {
      gasOptimizations.push("Uncached array length: Loop condition recalculates storage array length on every iteration.");
    }

    // Gas: custom errors vs require strings
    if (/require\s*\([^,]+,\s*"[^"]{10,}"\)/i.test(sourceCode)) {
      gasOptimizations.push("Replace long require string reverts with custom errors (error CustomError()) to save 20-40 gas per call.");
    }

    // Gas: calldata vs memory
    if (/function\s+\w+\s*\([^)]*string\s+memory/i.test(sourceCode)) {
      gasOptimizations.push("Use 'calldata' instead of 'memory' for external read-only string/bytes arguments.");
    }
  } else {
    // Static Bytecode heuristic analysis
    // Check for selfdestruct opcode 0xff
    if (bytecode.toLowerCase().includes("ff")) {
      mediumIssues.push("Opcode pattern indicates potential SELFDESTRUCT (0xff) in runtime bytecode.");
    }
    // Check for delegatecall opcode 0xf4
    if (bytecode.toLowerCase().includes("f4")) {
      mediumIssues.push("Opcode pattern indicates DELEGATECALL (0xf4) instruction in runtime bytecode.");
    }
    if (!sourceVerified) {
      mediumIssues.push("Unverified source code on Monadscan. Bytecode analysis completed via Monad Testnet RPC.");
    }
    gasOptimizations.push("Bytecode size: " + Math.floor((bytecode.length - 2) / 2) + " bytes. Ensure optimizer runs are tuned to 200+ runs.");
  }

  return {
    contractAddress,
    sourceVerified,
    compilerVersion,
    contractName,
    criticalIssues,
    mediumIssues,
    gasOptimizations,
    timestamp: new Date().toISOString()
  };
}
