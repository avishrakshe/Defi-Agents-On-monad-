"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "../../../components/Navbar";
import { useAcademyStore, AcademyProgress } from "../../../lib/progress-store";

interface LessonData {
  id: string;
  title: string;
  readTime: string;
  objectives: string[];
  content: React.ReactNode;
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

const COURSES_DATA: Record<string, { title: string; storeKey: keyof AcademyProgress["paths"]; lessons: LessonData[] }> = {
  "monad-fundamentals": {
    title: "Monad Fundamentals",
    storeKey: "monad-fundamentals",
    lessons: [
      {
        id: "lesson-1",
        title: "1. What is Monad?",
        readTime: "4 min read",
        objectives: [
          "Understand Monad as a high-performance EVM-compatible Layer-1",
          "Learn Monad's core metrics: 10,000 TPS, 300ms block times, 600ms finality",
          "Distinguish Layer-1 execution performance from decentralization trade-offs"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              <strong>Monad</strong> is a decentralized, high-performance Layer-1 blockchain that introduces pipelined parallel execution and asynchronous state commitments while retaining <strong>100% full EVM bytecode compatibility</strong>.
            </p>
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200/80 my-3">
              <span className="font-bold text-purple-900 block mb-1">Core Performance Specs:</span>
              <ul className="list-disc list-inside space-y-1 text-xs text-purple-800">
                <li><strong>Throughput:</strong> 10,000 real-world transactions per second (TPS)</li>
                <li><strong>Block Frequency:</strong> 300 ms blocks (sub-second user experience)</li>
                <li><strong>Single-Slot Finality:</strong> ~600 ms (two consecutive block confirmations)</li>
                <li><strong>Consensus:</strong> MonadBFT (pipelined Byzantine Fault Tolerance)</li>
              </ul>
            </div>
            <p>
              Unlike alternative high-throughput blockchains that sacrificed EVM support for novel virtual machines, Monad developers can reuse their existing Solidity contracts, Viem/Ethers scripts, and MetaMask wallet flows without modification.
            </p>
          </div>
        ),
        quiz: {
          question: "What is Monad's throughput target and block frequency?",
          options: [
            "100 TPS with 12-second blocks",
            "10,000 TPS with 300ms blocks and 600ms finality",
            "5,000 TPS with 5-minute blocks",
            "1,000 TPS with zero finality"
          ],
          correctIndex: 1,
          explanation: "Monad achieves 10,000 TPS with 300ms block times and ~600ms deterministic finality while preserving full EVM compatibility."
        }
      },
      {
        id: "lesson-2",
        title: "2. Why Monad is Fast: Parallel Execution",
        readTime: "5 min read",
        objectives: [
          "Understand the difference between serial and parallel EVM execution",
          "Learn how Optimistic Concurrency Control handles state conflicts",
          "Understand asynchronous I/O and separate state commitment"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              Standard Ethereum nodes execute transactions <em>serially</em>: one transaction finishes before the next begins. Monad implements <strong>pipelined parallel execution</strong> using optimistic concurrency.
            </p>
            <p>
              Transactions execute across multiple CPU cores simultaneously. If transaction B reads a storage slot updated by transaction A, the engine detects the dependency conflict and re-executes transaction B with the updated state.
            </p>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs">
              [Tx 1: Swap MON] ──▶ Core 1 ──┐<br />
              [Tx 2: Transfer USDC] ─▶ Core 2 ─┼──▶ Pipelined Merge ──▶ 600ms Finality<br />
              [Tx 3: NFT Mint] ──▶ Core 3 ──┘
            </div>
          </div>
        ),
        quiz: {
          question: "How does Monad resolve state conflicts during parallel execution?",
          options: [
            "It drops the conflicting transaction",
            "It pauses the entire blockchain",
            "It rolls back and re-executes only the conflicting transaction with updated state",
            "It charges a 100x fee penalty"
          ],
          correctIndex: 2,
          explanation: "Monad uses optimistic concurrency: conflicting transactions are cleanly re-executed with the updated inputs without stalling independent transactions."
        }
      },
      {
        id: "lesson-3",
        title: "3. Monad for Ethereum Developers",
        readTime: "4 min read",
        objectives: [
          "Configure standard EVM tools for Monad Testnet and Mainnet",
          "Identify the official RPC, Chain ID, and block explorer endpoints",
          "Verify Solidity bytecode parity with Ethereum"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              Because Monad implements the EVM specification directly at the bytecode level, your contracts compiled with `solc` 0.8.x run out of the box.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-100 font-bold">
                  <tr>
                    <th className="p-2 text-left">Property</th>
                    <th className="p-2 text-left">Monad Testnet Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  <tr><td className="p-2 font-sans font-medium">Chain ID</td><td className="p-2 text-purple-700 font-bold">10143 (0x279f)</td></tr>
                  <tr><td className="p-2 font-sans font-medium">Currency</td><td className="p-2 font-bold">MON</td></tr>
                  <tr><td className="p-2 font-sans font-medium">Public RPC</td><td className="p-2">https://testnet-rpc.monad.xyz</td></tr>
                  <tr><td className="p-2 font-sans font-medium">Explorer</td><td className="p-2">https://testnet.monadvision.com</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        ),
        quiz: {
          question: "What is the official Monad Testnet Chain ID?",
          options: ["1", "137", "10143", "42161"],
          correctIndex: 2,
          explanation: "Monad Testnet uses Chain ID 10143 (hex: 0x279f) and native currency MON."
        }
      },
      {
        id: "lesson-4",
        title: "4. Your First Monad Transaction",
        readTime: "4 min read",
        objectives: [
          "Connect a browser wallet to Monad Testnet",
          "Sign an EIP-155 transaction using native MON",
          "Verify sub-second block confirmation on MonadVision"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              Every transaction on Monad follows standard Ethereum transaction formatting (`eth_sendRawTransaction`). Due to Monad's 300ms block production, your transaction receipt arrives in under one second.
            </p>
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/80">
              <span className="font-bold text-emerald-900 block mb-1">Live Monad Testnet Verification:</span>
              <p className="text-xs text-emerald-800">
                You can inspect our deployed contract transactions live on MonadVision:
              </p>
              <a
                href="https://testnet.monadvision.com/address/0xD62b32482874E447Beb60E6Df5A21E6ebaFf54ad"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono font-bold text-emerald-700 hover:underline block mt-1"
              >
                0xD62b32482874E447Beb60E6Df5A21E6ebaFf54ad ↗
              </a>
            </div>
          </div>
        ),
        quiz: {
          question: "How fast is single-slot finality on Monad?",
          options: ["12 minutes", "10 seconds", "Approximately 600 ms", "1 hour"],
          correctIndex: 2,
          explanation: "With 300ms block times, two consecutive confirmations take approximately 600ms, providing near-instant deterministic finality."
        }
      },
      {
        id: "lesson-5",
        title: "5. Build and Deploy a Solidity Contract",
        readTime: "5 min read",
        objectives: [
          "Write a minimal stateful greeting contract in Solidity",
          "Deploy using Hardhat / Foundry to Monad Testnet",
          "Interact with contract storage onchain"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              Here is a production-compatible greeting contract deployable on Monad Testnet:
            </p>
            <pre className="p-4 bg-gray-950 text-gray-100 rounded-2xl font-mono text-xs overflow-x-auto">
{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MonadGreeting {
    string public greeting = "Hello, Monad!";
    address public owner;

    event GreetingUpdated(string newGreeting, address indexed updater);

    constructor() {
        owner = msg.sender;
    }

    function updateGreeting(string calldata newGreeting) external {
        greeting = newGreeting;
        emit GreetingUpdated(newGreeting, msg.sender);
    }
}`}
            </pre>
            <p>
              Once deployed, you can verify source code on MonadVision using the standard EVM verification API.
            </p>
          </div>
        ),
        quiz: {
          question: "Can standard Solidity contracts compiled for Ethereum run on Monad?",
          options: [
            "No, you must rewrite them in Rust",
            "Yes, without changes, because Monad has 100% EVM bytecode compatibility",
            "Only ERC-20 tokens are supported",
            "Only contracts compiled with Move work"
          ],
          correctIndex: 1,
          explanation: "Yes! Monad is 100% EVM bytecode compatible, so any Solidity contract compiles and runs directly on Monad."
        }
      }
    ]
  },
  "tokenized-assets": {
    title: "Tokenized Assets on Monad",
    storeKey: "tokenized-assets",
    lessons: [
      {
        id: "lesson-1",
        title: "1. What are Tokenized Assets?",
        readTime: "4 min read",
        objectives: [
          "Understand tokenization of real-world assets (RWAs)",
          "Distinguish onchain tokens from legal underlying custody",
          "Explain why institutional capital requires sub-second EVM settlement"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              <strong>Tokenization</strong> represents rights, claims, or economic exposure to real-world assets (such as Treasury bills, equities, credit vaults, or commodities) in an onchain cryptographic format.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              <strong>Educational Disclaimer:</strong> Tokenized assets may represent economic exposure or contractual claims; they do not automatically guarantee direct legal title to the underlying asset without specific custodian agreements.
            </div>
          </div>
        ),
        quiz: {
          question: "What does an onchain tokenized asset represent?",
          options: [
            "An automatic legal replacement of sovereign property registries",
            "An onchain claim, right, or exposure defined by the issuer and custodian structure",
            "A guarantee that the asset's price will never drop",
            "An unregulated anonymous bearer asset"
          ],
          correctIndex: 1,
          explanation: "Tokenized assets represent contractual rights or economic exposure backed by the legal custody and issuer framework."
        }
      },
      {
        id: "lesson-2",
        title: "2. The Asset Lifecycle",
        readTime: "5 min read",
        objectives: [
          "Map the pipeline: Custody → KYC → Issuance → Trading → Redemption",
          "Learn role-based access controls for permissioned tokens",
          "Inspect how NAV and pricing oracles update onchain"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              Institutional RWA tokens require a deterministic multi-stage lifecycle:
            </p>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl font-mono text-xs space-y-1">
              <div>1. Custody: Underlying assets deposited with regulated custodian / bank</div>
              <div>2. Eligibility: Investor wallet completes KYC / allowlist check</div>
              <div>3. Issuance: Smart contract mints 1:1 backed ERC-20 representation</div>
              <div>4. Transfer: High-speed peer-to-peer settlement on Monad</div>
              <div>5. Redemption: Investor burns tokens; custodian returns fiat / assets</div>
            </div>
          </div>
        ),
        quiz: {
          question: "What must happen before an institutional tokenized asset is redeemed?",
          options: [
            "The blockchain must fork",
            "The user must burn or transfer back the onchain tokens to release underlying funds",
            "All validator nodes must be replaced",
            "The market price must equal zero"
          ],
          correctIndex: 1,
          explanation: "Redemption involves burning the token representation onchain so the custodian releases the corresponding underlying collateral."
        }
      },
      {
        id: "lesson-3",
        title: "3. Tokenized Equities & Stocks",
        readTime: "4 min read",
        objectives: [
          "Compare 1:1 backed equities vs synthetic derivative exposure",
          "Identify transfer restriction compliance rules",
          "Learn how dividends and corporate actions pass through"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              Tokenized equities on Monad allow 24/7 fractional secondary market trading of public stocks with instant 600ms settlement, eliminating traditional T+1 / T+2 clearing delays.
            </p>
          </div>
        ),
        quiz: {
          question: "Why is Monad's 600ms finality transformative for equity trading?",
          options: [
            "It eliminates multi-day T+1 settlement cycles and counterparty risk",
            "It makes stocks impossible to sell",
            "It removes all market volatility",
            "It requires stock exchanges to shut down"
          ],
          correctIndex: 0,
          explanation: "Instant sub-second finality replaces multi-day clearinghouse settlement with atomic onchain delivery-versus-payment (DvP)."
        }
      },
      {
        id: "lesson-4",
        title: "4. Tokenized Treasuries & Yield Models",
        readTime: "4 min read",
        objectives: [
          "Understand yield accrual mechanisms (rebasing vs accumulating NAV)",
          "Learn how institutional credit vaults operate onchain",
          "Explore ecosystem examples like Etherfuse on Monad"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              Tokenized short-term sovereign debt (e.g. U.S. T-Bills, Korean treasury bonds) serves as onchain yield-bearing collateral. Yield is typically delivered either by rebasing token balances or increasing the redemption price relative to USDC.
            </p>
          </div>
        ),
        quiz: {
          question: "How do accumulating NAV treasury tokens distribute interest?",
          options: [
            "By increasing the redemption value of each token relative to fiat/USDC over time",
            "By mining Bitcoin",
            "By randomly deleting wallet addresses",
            "By requiring users to pay monthly fees"
          ],
          correctIndex: 0,
          explanation: "Accumulating tokens hold balance constant while the redemption rate per token grows to reflect accrued interest."
        }
      },
      {
        id: "lesson-5",
        title: "5. Compliance & Educational Contract Lab",
        readTime: "5 min read",
        objectives: [
          "Inspect an allowlist-restricted ERC-20 contract",
          "Understand transfer hooks for regulatory compliance",
          "Deploy an educational compliant token on Monad Testnet"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              In regulated assets, transfers are restricted to approved wallets:
            </p>
            <pre className="p-4 bg-gray-950 text-gray-100 rounded-2xl font-mono text-xs overflow-x-auto">
{`function _update(address from, address to, uint256 amount) internal override {
    if (from != address(0)) require(approved[from], "Sender not approved");
    if (to != address(0)) require(approved[to], "Recipient not approved");
    super._update(from, to, amount);
}`}
            </pre>
          </div>
        ),
        quiz: {
          question: "What is the purpose of the _update hook in a compliant asset token?",
          options: [
            "To verify that both sender and recipient are authorized before allowing transfers",
            "To delete unauthorized tokens",
            "To slow down the blockchain",
            "To hide the balances from the explorer"
          ],
          correctIndex: 0,
          explanation: "The hook intercepts every transfer to enforce that both parties satisfy compliance and KYC allowlists."
        }
      }
    ]
  },
  "x402-payments": {
    title: "x402 Payments on Monad",
    storeKey: "x402-payments",
    lessons: [
      {
        id: "lesson-1",
        title: "1. What is the x402 Protocol?",
        readTime: "4 min read",
        objectives: [
          "Understand HTTP 402 Payment Required for machine-to-machine APIs",
          "Learn how x402 replaces API keys, subscriptions, and credit card gateways",
          "Explore micropayments for autonomous AI agents"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              <strong>x402</strong> is an open payment protocol that brings the reserved <strong>HTTP 402 Payment Required</strong> status to life. Instead of signing up for monthly subscriptions or managing API keys, an API client simply pays fractions of a cent per request in stablecoins (e.g. USDC).
            </p>
          </div>
        ),
        quiz: {
          question: "What problem does x402 solve for APIs and AI agents?",
          options: [
            "It eliminates the need for API keys and subscriptions by enabling instant pay-per-call micropayments",
            "It replaces the internet with private networks",
            "It makes all web data free",
            "It slows down automated bots"
          ],
          correctIndex: 0,
          explanation: "x402 allows clients and autonomous agents to pay per request directly over HTTP without custodial accounts or API keys."
        }
      },
      {
        id: "lesson-2",
        title: "2. The Request & Settlement Lifecycle",
        readTime: "5 min read",
        objectives: [
          "Trace the 402 challenge flow",
          "Learn the standard headers: PAYMENT-REQUIRED & PAYMENT-SIGNATURE",
          "Understand facilitator verification and batch onchain settlement"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              The x402 lifecycle:
            </p>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl font-mono text-xs space-y-1">
              <div>1. Client sends GET /api/data</div>
              <div>2. Server returns HTTP 402 with PAYMENT-REQUIRED header (price: $0.001 USDC)</div>
              <div>3. Client cryptographically signs EIP-712 payment authorization</div>
              <div>4. Client retries GET /api/data with PAYMENT-SIGNATURE header</div>
              <div>5. Server verifies signature, returns payload, and settles on Monad</div>
            </div>
          </div>
        ),
        quiz: {
          question: "Which header carries the client's cryptographic payment authorization?",
          options: ["AUTHORIZATION-BEARER", "PAYMENT-SIGNATURE", "COOKIE", "X-API-KEY"],
          correctIndex: 1,
          explanation: "The PAYMENT-SIGNATURE header contains the client's signed EIP-712 payment authorization payload."
        }
      },
      {
        id: "lesson-3",
        title: "3. Build a Payable API Endpoint",
        readTime: "5 min read",
        objectives: [
          "Protect a Next.js / Express route with x402 middleware",
          "Configure price, pay-to address, and Monad USDC contract",
          "Verify payment signatures before serving premium data"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              Our marketplace specialist agents on ports 4001, 4002, 4003, and 4004 all implement this exact middleware:
            </p>
            <pre className="p-4 bg-gray-950 text-gray-100 rounded-2xl font-mono text-xs overflow-x-auto">
{`function verifyX402Payment(req, res, next) {
    const auth = JSON.parse(req.headers['x-payment-authorization']);
    const recovered = ethers.verifyTypedData(domain, types, auth, auth.signature);
    if (recovered.toLowerCase() !== auth.from.toLowerCase()) {
        return res.status(402).json({ error: "Payment required" });
    }
    next();
}`}
            </pre>
          </div>
        ),
        quiz: {
          question: "What verifies the authenticity of an x402 payment?",
          options: [
            "A centralized password check",
            "An EIP-712 ECDSA signature verification against the verifying contract",
            "The client's IP address",
            "A CAPTCHA challenge"
          ],
          correctIndex: 1,
          explanation: "EIP-712 typed data signatures allow the server and facilitator to mathematically verify payment authorization without knowing the private key."
        }
      },
      {
        id: "lesson-4",
        title: "4. The Monad x402 Facilitator",
        readTime: "4 min read",
        objectives: [
          "Understand the role of a payment facilitator",
          "Explore endpoints: /supported, /verify, /settle",
          "Learn how facilitators cover gas fees on behalf of APIs"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              The Monad testnet facilitator at `https://x402-facilitator.molandak.org` allows API providers to verify client signatures without executing individual gas-intensive blockchain transactions per HTTP call. Instead, micropayments are batched and settled directly on Monad.
            </p>
          </div>
        ),
        quiz: {
          question: "What service does the x402 facilitator provide?",
          options: [
            "It holds custody of user private keys",
            "It verifies payment payloads and submits settlement transactions to Monad",
            "It replaces the database",
            "It creates user accounts"
          ],
          correctIndex: 1,
          explanation: "The facilitator handles signature verification and onchain settlement submission, allowing servers to stay lightweight."
        }
      },
      {
        id: "lesson-5",
        title: "5. Autonomous Agent Marketplaces & ERC-8004",
        readTime: "5 min read",
        objectives: [
          "Understand agent-to-agent autonomous commerce",
          "Combine ERC-8004 identity with x402 payments",
          "Track onchain agent reputation and paid call history"
        ],
        content: (
          <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p>
              When AI agents make decisions autonomously, they need verifiable identity (ERC-8004) and payment rails (x402). In our DeFi Agent Marketplace, agents discover specialists in `IdentityRegistry`, pay them $0.001 USDC via x402, and rate them in `ReputationRegistry` directly on Monad Testnet!
            </p>
          </div>
        ),
        quiz: {
          question: "How do autonomous agents establish trust in an open marketplace?",
          options: [
            "By asking users to manually approve every API call",
            "Through onchain identity registries, staking, and verifiable paid call reputation",
            "By having the same creator",
            "By disabling payments"
          ],
          correctIndex: 1,
          explanation: "ERC-8004 identity and onchain reputation ensure agents build verifiable, sybil-resistant track records backed by real onchain transactions."
        }
      }
    ]
  }
};

export default function LessonDetailPage() {
  const params = useParams();
  const pathId = (params?.pathId as string) || "monad-fundamentals";
  const course = COURSES_DATA[pathId] || COURSES_DATA["monad-fundamentals"];

  const { paths, completeLesson } = useAcademyStore();
  const pathProgress = paths[course.storeKey];

  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [mobileTab, setMobileTab] = useState<"learn" | "challenge">("learn");

  const currentLesson = course.lessons[activeLessonIndex];
  const isLessonDone = pathProgress.completedLessons.includes(currentLesson.id);

  const handleSelectOption = (idx: number) => {
    if (!submitted) setSelectedOption(idx);
  };

  const handleSubmitQuiz = () => {
    if (selectedOption === null) return;
    setSubmitted(true);
    if (selectedOption === currentLesson.quiz.correctIndex) {
      completeLesson(course.storeKey, currentLesson.id, 50);
    }
  };

  const handleNextLesson = () => {
    setSelectedOption(null);
    setSubmitted(false);
    if (activeLessonIndex < course.lessons.length - 1) {
      setActiveLessonIndex(activeLessonIndex + 1);
    }
  };

  const isCorrect = submitted && selectedOption === currentLesson.quiz.correctIndex;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#f8f9fa] font-sans">
      <div>
        <Navbar />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
          {/* Breadcrumb & Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Link href="/learn" className="hover:text-gray-900 transition-colors">
                Academy
              </Link>
              <span>/</span>
              <span className="font-semibold text-gray-800">{course.title}</span>
              <span>/</span>
              <span className="text-purple-700 font-bold">{currentLesson.title}</span>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="flex sm:hidden w-full bg-gray-200/80 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setMobileTab("learn")}
                className={`flex-1 py-1.5 rounded-lg text-center ${mobileTab === "learn" ? "bg-white text-gray-950 shadow-sm" : "text-gray-600"}`}
              >
                Learn
              </button>
              <button
                onClick={() => setMobileTab("challenge")}
                className={`flex-1 py-1.5 rounded-lg text-center ${mobileTab === "challenge" ? "bg-white text-gray-950 shadow-sm" : "text-gray-600"}`}
              >
                Challenge Quiz
              </button>
            </div>
          </div>

          {/* Split-Screen Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left 60%: Interactive Documentation Reader (7 cols on lg) */}
            <div className={`lg:col-span-7 ${mobileTab === "challenge" ? "hidden lg:block" : ""}`}>
              <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 sm:p-10">
                {/* Module Navigator Pills */}
                <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-100 pb-4">
                  {course.lessons.map((lesson, idx) => {
                    const done = pathProgress.completedLessons.includes(lesson.id);
                    const active = idx === activeLessonIndex;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => {
                          setActiveLessonIndex(idx);
                          setSelectedOption(null);
                          setSubmitted(false);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                          active
                            ? "bg-purple-700 text-white shadow-sm"
                            : done
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                            : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <span>{done ? "✓" : idx + 1}</span>
                        <span>{lesson.title.split(". ")[1] || lesson.title}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Lesson Title & Objectives */}
                <div className="mb-6">
                  <div className="flex items-center space-x-3 text-xs text-gray-400 mb-1 font-mono">
                    <span>{currentLesson.readTime}</span>
                    <span>•</span>
                    <span className="text-purple-700 font-bold">+50 XP</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight">
                    {currentLesson.title}
                  </h1>
                </div>

                {/* Learning Objectives Box */}
                <div className="bg-[#fcfcff] border border-purple-100 rounded-2xl p-4 sm:p-5 mb-8">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-900 block mb-2">
                    Learning Objectives:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-700">
                    {currentLesson.objectives.map((obj, i) => (
                      <li key={i}>{obj}</li>
                    ))}
                  </ul>
                </div>

                {/* Main Content Body */}
                <div className="border-t border-gray-100 pt-6">
                  {currentLesson.content}
                </div>

                {/* Footer Controls */}
                <div className="mt-10 pt-6 border-t border-gray-100 flex items-center justify-between">
                  <button
                    disabled={activeLessonIndex === 0}
                    onClick={() => {
                      if (activeLessonIndex > 0) {
                        setActiveLessonIndex(activeLessonIndex - 1);
                        setSelectedOption(null);
                        setSubmitted(false);
                      }
                    }}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                  >
                    ← Previous Lesson
                  </button>

                  <button
                    onClick={() => {
                      completeLesson(course.storeKey, currentLesson.id, 50);
                    }}
                    className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                      isLessonDone
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {isLessonDone ? "Lesson Completed ✓" : "Mark as Read"}
                  </button>

                  <button
                    disabled={activeLessonIndex === course.lessons.length - 1}
                    onClick={handleNextLesson}
                    className="px-4 py-2 rounded-xl bg-purple-700 text-white text-xs font-bold hover:bg-purple-800 disabled:opacity-30 shadow-sm"
                  >
                    Next Lesson →
                  </button>
                </div>
              </div>
            </div>

            {/* Right 40%: Contextual Challenge Quiz Panel (5 cols on lg, sticky) */}
            <div className={`lg:col-span-5 ${mobileTab === "learn" ? "hidden lg:block" : ""}`}>
              <div className="sticky top-20 bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 sm:p-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200/80">
                    KNOWLEDGE CHECK
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-500">
                    +50 XP
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-gray-950 mb-4 leading-snug">
                  {currentLesson.quiz.question}
                </h3>

                {/* Option Buttons */}
                <div className="space-y-2.5 mb-6">
                  {currentLesson.quiz.options.map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    let btnStyle = "bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100";

                    if (submitted) {
                      if (idx === currentLesson.quiz.correctIndex) {
                        btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold";
                      } else if (isSelected) {
                        btnStyle = "bg-rose-50 border-rose-300 text-rose-800";
                      }
                    } else if (isSelected) {
                      btnStyle = "bg-purple-50 border-purple-500 text-purple-900 font-bold";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectOption(idx)}
                        className={`w-full text-left p-3.5 rounded-2xl border text-xs leading-relaxed transition-all flex items-start space-x-3 ${btnStyle}`}
                      >
                        <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center flex-shrink-0 text-[10px] font-mono mt-0.5">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Submit / Action Button */}
                {!submitted ? (
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={selectedOption === null}
                    className="w-full btn-monad-lime py-3 rounded-xl text-xs font-bold disabled:opacity-40 shadow-sm transition-all"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div
                      className={`p-4 rounded-2xl text-xs leading-relaxed ${
                        isCorrect
                          ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                          : "bg-rose-50 border border-rose-200 text-rose-900"
                      }`}
                    >
                      <div className="font-bold mb-1 flex items-center space-x-1.5">
                        <span>{isCorrect ? "✓ Correct! +50 XP Earned" : "✕ Not quite"}</span>
                      </div>
                      <p>{currentLesson.quiz.explanation}</p>
                    </div>

                    <button
                      onClick={handleNextLesson}
                      className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      Continue to Next Lesson →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Ecosystem Legal Line */}
      <footer className="border-t border-gray-200/80 py-8 px-4 sm:px-8 text-center text-xs text-gray-500">
        <p className="max-w-4xl mx-auto leading-relaxed">
          Built for the Monad ecosystem. Not an official Monad Labs product unless otherwise stated. Issued by Monad Academy.
        </p>
      </footer>
    </div>
  );
}
