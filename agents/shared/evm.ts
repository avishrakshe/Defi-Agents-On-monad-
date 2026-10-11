import { ethers } from "ethers";
import { callMonadRpc, getContractBytecode } from "./monadRpc";

/* ------------------------------------------------------------------ */
/* Bytecode disassembly                                                */
/* ------------------------------------------------------------------ */

export interface Disassembly {
  sizeBytes: number;
  /** Opcode byte → occurrence count, counted only on real instructions (PUSH data skipped) */
  opcodeCounts: Map<number, number>;
  /** 4-byte values pushed with PUSH4 — the function selector dispatch table */
  selectors: Set<string>;
  /** Solidity compiler version from the CBOR metadata tail, when present */
  solcVersion?: string;
}

export const OP = {
  ORIGIN: 0x32,
  CREATE: 0xf0,
  CALL: 0xf1,
  CALLCODE: 0xf2,
  DELEGATECALL: 0xf4,
  CREATE2: 0xf5,
  STATICCALL: 0xfa,
  SELFDESTRUCT: 0xff,
  SSTORE: 0x55,
  TIMESTAMP: 0x42,
  PREVRANDAO: 0x44
} as const;

/**
 * Walks EVM bytecode instruction by instruction so PUSH payloads are never
 * mistaken for opcodes (a naive substring search for "ff" matches almost every contract).
 */
export function disassemble(bytecodeHex: string): Disassembly {
  const hex = bytecodeHex.startsWith("0x") ? bytecodeHex.slice(2) : bytecodeHex;
  const bytes = Buffer.from(hex, "hex");
  const metaLen = metadataLength(bytes);
  const codeEnd = bytes.length - metaLen;

  const opcodeCounts = new Map<number, number>();
  const selectors = new Set<string>();

  for (let i = 0; i < codeEnd; i++) {
    const op = bytes[i];
    opcodeCounts.set(op, (opcodeCounts.get(op) || 0) + 1);
    if (op >= 0x60 && op <= 0x7f) {
      const n = op - 0x5f;
      if (n === 4 && i + 4 < codeEnd) {
        selectors.add(bytes.subarray(i + 1, i + 5).toString("hex"));
      }
      i += n;
    }
  }

  return { sizeBytes: bytes.length, opcodeCounts, selectors, solcVersion: solcVersionFromMetadata(bytes) };
}

/** Length of the trailing CBOR metadata blob (last 2 bytes encode its size) */
function metadataLength(bytes: Buffer): number {
  if (bytes.length < 2) return 0;
  const len = bytes.readUInt16BE(bytes.length - 2);
  return len + 2 <= bytes.length && len < 200 ? len + 2 : 0;
}

function solcVersionFromMetadata(bytes: Buffer): string | undefined {
  const metaLen = metadataLength(bytes);
  if (!metaLen) return undefined;
  const meta = bytes.subarray(bytes.length - metaLen, bytes.length - 2);
  // CBOR text key "solc" (64 73 6f 6c 63) followed by a 3-byte bytestring (43 MM mm pp)
  const idx = meta.indexOf(Buffer.from("64736f6c6343", "hex"));
  if (idx === -1 || idx + 9 > meta.length) return undefined;
  const v = meta.subarray(idx + 6, idx + 9);
  return `${v[0]}.${v[1]}.${v[2]}`;
}

/* ------------------------------------------------------------------ */
/* Known function selectors                                            */
/* ------------------------------------------------------------------ */

/** Function signatures grouped by the privilege they grant; selectors are derived, never hand-typed */
export const SIGNATURE_GROUPS = {
  ownership: ["owner()", "transferOwnership(address)", "renounceOwnership()", "grantRole(bytes32,address)", "updateMasterMinter(address)"],
  upgrade: ["upgradeTo(address)", "upgradeToAndCall(address,bytes)", "changeAdmin(address)"],
  mint: ["mint(address,uint256)", "mint(uint256)", "configureMinter(address,uint256)", "mintTo(address,uint256)"],
  pause: ["pause()", "unpause()", "paused()"],
  blacklist: [
    "blacklist(address)", "unBlacklist(address)", "isBlacklisted(address)", "addToBlacklist(address)",
    "addBlackList(address)", "setBlacklist(address,bool)", "blacklistAddress(address,bool)", "setBots(address[])"
  ],
  fee: [
    "setTaxFeePercent(uint256)", "setFee(uint256)", "setFees(uint256,uint256)", "setBuyFee(uint256)", "setSellFee(uint256)",
    "excludeFromFee(address)", "setMaxTxAmount(uint256)", "setMaxWalletSize(uint256)", "enableTrading()", "openTrading()",
    "setTradingEnabled(bool)"
  ],
  selfdestruct: ["kill()", "destroy()"],
  eip3009: ["transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)", "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"],
  erc20: ["transfer(address,uint256)", "transferFrom(address,address,uint256)", "approve(address,uint256)", "balanceOf(address)", "totalSupply()"]
} as const;

export type PrivilegeGroup = keyof typeof SIGNATURE_GROUPS;

export const selectorOf = (signature: string) => ethers.id(signature).slice(2, 10);

const SELECTOR_TO_SIG = new Map<string, string>();
for (const sigs of Object.values(SIGNATURE_GROUPS)) for (const s of sigs) SELECTOR_TO_SIG.set(selectorOf(s), s);

/** Returns the human-readable signatures from `group` whose selector appears in the dispatch table */
export function matchGroup(selectors: Set<string>, group: PrivilegeGroup): string[] {
  return SIGNATURE_GROUPS[group].filter((s) => selectors.has(selectorOf(s)));
}

export const signatureOf = (selector: string) => SELECTOR_TO_SIG.get(selector);

/* ------------------------------------------------------------------ */
/* Proxy resolution                                                    */
/* ------------------------------------------------------------------ */

const IMPL_SLOTS = {
  "EIP-1967": "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  "ZeppelinOS": "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3",
  "EIP-1822": "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7"
};
const ADMIN_SLOTS = {
  "EIP-1967": "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
  "ZeppelinOS": "0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b"
};

export interface ProxyInfo {
  isProxy: boolean;
  standard?: string;
  implementation?: string;
  admin?: string;
}

const slotToAddress = (word?: string) => {
  if (!word || /^0x0*$/.test(word)) return undefined;
  const addr = "0x" + word.slice(-40);
  return /^0x0{40}$/.test(addr) ? undefined : ethers.getAddress(addr);
};

export async function resolveProxy(address: string, bytecode?: string): Promise<ProxyInfo> {
  const code = (bytecode ?? (await getContractBytecode(address))).toLowerCase();

  // EIP-1167 minimal proxy: 363d3d373d3d3d363d73<20-byte impl>5af43d82803e903d91602b57fd5bf3
  const minimal = code.match(/^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d/);
  if (minimal) return { isProxy: true, standard: "EIP-1167 minimal", implementation: ethers.getAddress("0x" + minimal[1]) };

  for (const [standard, slot] of Object.entries(IMPL_SLOTS)) {
    const impl = slotToAddress(await callMonadRpc("eth_getStorageAt", [address, slot, "latest"]).catch(() => undefined));
    if (impl) {
      const adminSlot = (ADMIN_SLOTS as Record<string, string>)[standard];
      const admin = adminSlot
        ? slotToAddress(await callMonadRpc("eth_getStorageAt", [address, adminSlot, "latest"]).catch(() => undefined))
        : undefined;
      return { isProxy: true, standard, implementation: impl, admin };
    }
  }
  return { isProxy: false };
}

/* ------------------------------------------------------------------ */
/* ABI helpers                                                         */
/* ------------------------------------------------------------------ */

const coder = ethers.AbiCoder.defaultAbiCoder();

/** Decodes a string return value, tolerating legacy bytes32-encoded names */
export function decodeAbiString(data?: string): string | undefined {
  if (!data || data === "0x") return undefined;
  try {
    return coder.decode(["string"], data)[0] as string;
  } catch {
    try {
      return ethers.decodeBytes32String(data.slice(0, 66));
    } catch {
      return undefined;
    }
  }
}

export async function ethCall(to: string, data: string): Promise<string | undefined> {
  try {
    return await callMonadRpc("eth_call", [{ to, data }, "latest"]);
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Log scanning (Monad RPC caps eth_getLogs at 100 blocks per request) */
/* ------------------------------------------------------------------ */

export async function getLogsChunked(
  filter: { address?: string; topics?: (string | null)[] },
  totalBlocks: number,
  chunk = 100,
  concurrency = 8
): Promise<{ logs: any[]; fromBlock: number; toBlock: number; failedChunks: number }> {
  const latest = parseInt(await callMonadRpc("eth_blockNumber", []), 16);
  const fromBlock = Math.max(0, latest - totalBlocks + 1);
  const ranges: [number, number][] = [];
  for (let start = fromBlock; start <= latest; start += chunk) {
    ranges.push([start, Math.min(latest, start + chunk - 1)]);
  }

  const logs: any[] = [];
  let failedChunks = 0;
  for (let i = 0; i < ranges.length; i += concurrency) {
    const batch = ranges.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(([a, b]) =>
        callMonadRpc("eth_getLogs", [{ ...filter, fromBlock: "0x" + a.toString(16), toBlock: "0x" + b.toString(16) }])
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled" && Array.isArray(r.value)) logs.push(...r.value);
      else failedChunks++;
    }
  }
  return { logs, fromBlock, toBlock: latest, failedChunks };
}

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
