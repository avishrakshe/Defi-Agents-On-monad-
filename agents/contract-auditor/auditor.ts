import { ethers } from "ethers";
import { getContractBytecode } from "../shared/monadRpc";
import { disassemble, matchGroup, resolveProxy, OP } from "../shared/evm";

export type Severity = "critical" | "high" | "medium" | "low" | "info" | "gas";

export interface Finding {
  severity: Severity;
  title: string;
  detail: string;
  location?: string;
}

export interface AuditResult {
  contractAddress: string;
  analyzedAddress: string;
  sourceVerified: boolean;
  verificationSource?: string;
  compilerVersion?: string;
  contractName?: string;
  isProxy: boolean;
  proxyStandard?: string;
  implementation?: string;
  proxyAdmin?: string;
  bytecodeSizeBytes: number;
  filesAnalyzed: number;
  privilegedFunctions: string[];
  findings: Finding[];
  securityScore: number;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  // Legacy summary arrays (kept for existing consumers)
  criticalIssues: string[];
  mediumIssues: string[];
  gasOptimizations: string[];
  timestamp: string;
}

const CHAIN_ID = 10143;
const PENALTY: Record<Severity, number> = { critical: 30, high: 15, medium: 6, low: 2, info: 0, gas: 0 };

interface VerifiedSource {
  origin: string;
  contractName?: string;
  compilerVersion?: string;
  files: { path: string; content: string }[];
}

/** Sourcify is the verifier MonadVision uses; Etherscan v2 is tried when an API key is configured */
async function fetchVerifiedSource(address: string): Promise<VerifiedSource | null> {
  try {
    const res = await fetch(`https://sourcify.dev/server/v2/contract/${CHAIN_ID}/${address}?fields=compilation,sources`, {
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      const j: any = await res.json();
      if (j.sources && Object.keys(j.sources).length) {
        return {
          origin: `Sourcify (${j.match || "match"})`,
          contractName: j.compilation?.name,
          compilerVersion: j.compilation?.compilerVersion,
          files: Object.entries(j.sources).map(([path, v]: [string, any]) => ({ path, content: v.content || "" }))
        };
      }
    }
  } catch {}

  const key = process.env.ETHERSCAN_API_KEY;
  if (key) {
    try {
      const url = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=contract&action=getsourcecode&address=${address}&apikey=${key}`;
      const j: any = await (await fetch(url, { signal: AbortSignal.timeout(8000) })).json();
      const item = j?.result?.[0];
      if (item?.SourceCode) {
        return { origin: "Etherscan v2", contractName: item.ContractName, compilerVersion: item.CompilerVersion, files: [{ path: `${item.ContractName}.sol`, content: item.SourceCode }] };
      }
    } catch {}
  }
  return null;
}

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const isLibraryPath = (p: string) => /(^|\/)(@openzeppelin|node_modules|lib\/forge-std|@chainlink)\//i.test(p);
const lineOf = (src: string, idx: number) => src.slice(0, idx).split("\n").length;

/** Source-level rules, applied only to project files (audited libraries are skipped to avoid noise) */
function analyzeSource(src: VerifiedSource, findings: Finding[]) {
  const projectFiles = src.files.filter((f) => !isLibraryPath(f.path));
  const major = src.compilerVersion?.match(/^v?0\.(\d+)/)?.[1];
  // SafeMath is usually attached once (`using SafeMath for uint256`) in a base contract, so check the whole bundle
  const bundleUsesSafeMath = src.files.some((f) => /using\s+SafeMath\s+for/.test(f.content));
  let overflowReported = false;

  for (const file of projectFiles) {
    const code = stripComments(file.content);
    const at = (re: RegExp) => {
      const m = re.exec(code);
      return m ? `${file.path}:${lineOf(code, m.index)}` : undefined;
    };
    const add = (severity: Severity, title: string, detail: string, re: RegExp) => {
      const loc = at(re);
      if (loc) findings.push({ severity, title, detail, location: loc });
    };

    add("critical", "tx.origin authorization", "Access control relies on tx.origin, which a malicious intermediary contract can spoof. Use msg.sender.", /require\s*\([^;]*tx\.origin|tx\.origin\s*==|==\s*tx\.origin/);
    add("high", "selfdestruct present", "The contract can be destroyed, permanently removing code and stranding funds.", /\bselfdestruct\s*\(|\bsuicide\s*\(/);
    if (/\.call\s*\{\s*value\s*:/.test(code) && !/nonReentrant|ReentrancyGuard/.test(code)) {
      add("high", "Reentrancy risk", "ETH is sent with a low-level call and no ReentrancyGuard; state written after the call can be re-entered.", /\.call\s*\{\s*value\s*:/);
    }
    if (/\.delegatecall\s*\(/.test(code)) {
      add("medium", "delegatecall usage", "delegatecall executes foreign code in this contract's storage context; ensure the target is immutable or tightly access-controlled.", /\.delegatecall\s*\(/);
    }
    // Low-level call whose boolean result is discarded
    const unchecked = /^\s*(?!\(bool|bool\s|require|if|return)[^;=\n]*\.(call|send)\s*(\{[^}]*\})?\s*\(/m;
    add("medium", "Unchecked low-level call", "The return value of a low-level call/send is ignored; failures will pass silently.", unchecked);
    if (/block\.timestamp|\bnow\b/.test(code) && /random|winner|lottery|roll/i.test(code)) {
      add("medium", "Weak randomness", "block.timestamp is used as an entropy source, which validators can influence.", /block\.timestamp|\bnow\b/);
    }
    if (/ecrecover\s*\(/.test(code) && !/!=\s*address\(0\)|ECDSA/.test(code)) {
      add("medium", "Unchecked ecrecover", "ecrecover returns address(0) for invalid signatures; check the result against zero or use OpenZeppelin ECDSA.", /ecrecover\s*\(/);
    }
    if (major && Number(major) < 8 && !bundleUsesSafeMath && !overflowReported && /[+\-*]\s*=/.test(code)) {
      overflowReported = true;
      add("medium", "Arithmetic overflow possible", `Compiled with solc 0.${major}.x (no built-in overflow checks) and no SafeMath in the source bundle.`, /[+\-*]\s*=/);
    }
    add("low", "Floating pragma", "Lock the pragma to the exact audited compiler version.", /pragma\s+solidity\s*\^/);
    add("gas", "Uncached array length in loop", "Cache array.length in a local variable before looping.", /for\s*\([^;]*;\s*\w+\s*<\s*[\w.]+\.length\s*;/);
    add("gas", "Long revert strings", "Replace long require() strings with custom errors to cut deployment and revert gas.", /require\s*\([^;]*,\s*"[^"]{32,}"\s*\)/);
    add("gas", "memory params on external functions", "Use calldata for read-only external string/bytes/array parameters.", /function\s+\w+\s*\([^)]*\b(string|bytes)\s+memory[^)]*\)\s*external/);
  }

  return projectFiles.length;
}

/** Bytecode-level analysis on real decoded instructions */
function analyzeBytecode(code: string, findings: Finding[], hasSource: boolean) {
  const dis = disassemble(code);
  const count = (op: number) => dis.opcodeCounts.get(op) || 0;

  if (count(OP.SELFDESTRUCT)) findings.push({ severity: "high", title: "SELFDESTRUCT opcode", detail: `${count(OP.SELFDESTRUCT)} SELFDESTRUCT instruction(s) in runtime code.` });
  if (count(OP.CALLCODE)) findings.push({ severity: "high", title: "CALLCODE opcode", detail: "Deprecated CALLCODE is used; it is unsafe and superseded by DELEGATECALL." });
  if (count(OP.DELEGATECALL) && !hasSource) findings.push({ severity: "medium", title: "DELEGATECALL opcode", detail: `${count(OP.DELEGATECALL)} DELEGATECALL instruction(s) — code from another contract runs with this contract's storage.` });
  if (count(OP.ORIGIN) && !hasSource) findings.push({ severity: "medium", title: "ORIGIN opcode", detail: "tx.origin is read; confirm it is not used for authorization." });
  if (count(OP.CREATE2)) findings.push({ severity: "info", title: "CREATE2 factory", detail: "Contract can deploy child contracts at deterministic addresses." });
  if (dis.sizeBytes > 24576) findings.push({ severity: "low", title: "Exceeds EIP-170 size", detail: `${dis.sizeBytes} bytes is above the 24,576-byte limit used on Ethereum mainnet.` });

  return dis;
}

export async function auditContract(contractAddress: string): Promise<AuditResult> {
  const address = ethers.getAddress(contractAddress);
  const findings: Finding[] = [];

  const bytecode = await getContractBytecode(address);
  if (!bytecode || bytecode === "0x") {
    findings.push({ severity: "critical", title: "No contract code", detail: "Address is an EOA or has no deployed runtime bytecode on Monad Testnet." });
    return finalize({
      contractAddress: address,
      analyzedAddress: address,
      sourceVerified: false,
      isProxy: false,
      bytecodeSizeBytes: 0,
      filesAnalyzed: 0,
      privilegedFunctions: [],
      findings
    });
  }

  // Proxies: audit the implementation logic, report the proxy's admin surface
  const proxy = await resolveProxy(address, bytecode);
  const analyzedAddress = proxy.implementation || address;
  const logicCode = proxy.implementation ? await getContractBytecode(proxy.implementation) : bytecode;

  if (proxy.isProxy) {
    findings.push({
      severity: "medium",
      title: "Upgradeable proxy",
      detail: `${proxy.standard} proxy. Implementation ${proxy.implementation}${proxy.admin ? `, upgrade admin ${proxy.admin}` : ""}. Logic can be replaced without user consent.`
    });
  }

  const source = (await fetchVerifiedSource(analyzedAddress)) || (proxy.isProxy ? await fetchVerifiedSource(address) : null);
  let filesAnalyzed = 0;
  if (source) {
    filesAnalyzed = analyzeSource(source, findings);
  } else {
    findings.push({ severity: "low", title: "Unverified source", detail: "No verified source on Sourcify — findings are derived from decoded bytecode only." });
  }

  const dis = analyzeBytecode(logicCode, findings, !!source);

  // Privileged admin surface from the dispatch table
  const privileged = [
    ...matchGroup(dis.selectors, "ownership"),
    ...matchGroup(dis.selectors, "upgrade"),
    ...matchGroup(dis.selectors, "mint"),
    ...matchGroup(dis.selectors, "pause"),
    ...matchGroup(dis.selectors, "blacklist"),
    ...matchGroup(dis.selectors, "fee")
  ];
  if (privileged.length) {
    findings.push({
      severity: "info",
      title: "Privileged functions",
      detail: `${privileged.length} admin-gated entry points: ${privileged.slice(0, 8).join(", ")}${privileged.length > 8 ? "…" : ""}.`
    });
  }

  return finalize({
    contractAddress: address,
    analyzedAddress,
    sourceVerified: !!source,
    verificationSource: source?.origin,
    compilerVersion: source?.compilerVersion || (dis.solcVersion ? `v${dis.solcVersion} (from metadata)` : undefined),
    contractName: source?.contractName,
    isProxy: proxy.isProxy,
    proxyStandard: proxy.standard,
    implementation: proxy.implementation,
    proxyAdmin: proxy.admin,
    bytecodeSizeBytes: dis.sizeBytes,
    filesAnalyzed,
    privilegedFunctions: privileged,
    findings
  });
}

function finalize(r: Omit<AuditResult, "securityScore" | "riskLevel" | "criticalIssues" | "mediumIssues" | "gasOptimizations" | "timestamp">): AuditResult {
  const order: Severity[] = ["critical", "high", "medium", "low", "info", "gas"];
  // Collapse repeats of the same rule into one finding that lists where it occurs
  const grouped = new Map<string, Finding & { locations: string[] }>();
  for (const f of r.findings) {
    const key = `${f.severity}|${f.title}`;
    const g = grouped.get(key);
    if (g) {
      if (f.location) g.locations.push(f.location);
    } else {
      grouped.set(key, { ...f, locations: f.location ? [f.location] : [] });
    }
  }
  r.findings = [...grouped.values()].map(({ locations, ...f }) => ({
    ...f,
    location: locations.length > 1 ? `${locations[0].split("/").pop()} +${locations.length - 1} more` : locations[0]?.split("/").pop()
  }));
  r.findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  const securityScore = Math.max(0, 100 - r.findings.reduce((s, f) => s + PENALTY[f.severity], 0));
  const riskLevel = r.findings.some((f) => f.severity === "critical")
    ? "Critical"
    : securityScore < 50
    ? "High"
    : securityScore < 80
    ? "Medium"
    : "Low";
  const fmt = (f: Finding) => `${f.title}: ${f.detail}${f.location ? ` (${f.location})` : ""}`;
  return {
    ...r,
    securityScore,
    riskLevel,
    criticalIssues: r.findings.filter((f) => f.severity === "critical" || f.severity === "high").map(fmt),
    mediumIssues: r.findings.filter((f) => f.severity === "medium").map(fmt),
    gasOptimizations: r.findings.filter((f) => f.severity === "gas").map(fmt),
    timestamp: new Date().toISOString()
  };
}
