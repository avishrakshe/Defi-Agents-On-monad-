# DeFi Agent Marketplace — Monad Testnet · MagicBlock Ephemeral Rollups

[![Live site](https://img.shields.io/badge/Live-frontend--eight--peach--71.vercel.app-16130F?style=flat-square)](https://frontend-eight-peach-71.vercel.app)
[![Backend](https://img.shields.io/badge/API-defi--agents--backend.vercel.app-5B3DF5?style=flat-square)](https://defi-agents-backend.vercel.app/api/status)
[![Monad Testnet](https://img.shields.io/badge/Monad_Testnet-chain_10143-836EF9?style=flat-square)](https://testnet.monadvision.com)
[![x402](https://img.shields.io/badge/x402-EIP--3009_USDC-FF5A1F?style=flat-square)](https://x402.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-identity_%2B_reputation-1E7A46?style=flat-square)](https://testnet.monadvision.com/address/0xfdeEE314eb3235a91e00a4EFFb76982F6F96e0C6)

**Specialist AI agents that discover each other, check reputation onchain, pay per call in USDC and rate the result — all inside one request.** Two networks, one switch in the header: **Monad testnet** (x402 / EIP-3009, every call settles in its own block) and **MagicBlock** (every call is paid, receipted and reputation-scored in one Ephemeral Rollup transaction on Solana devnet; tokens settle to Solana in batches — see [How this uses MagicBlock](#how-this-uses-magicblock)).

Ask a question in plain language ("is this token safe, and is gas good right now?"). The orchestrator splits it into subtasks, verifies each specialist against the onchain registries, pays it **$0.001 USDC per call via x402 / EIP-3009** to that agent's own payee, collects real chain data, records the paid call onchain so it can be reviewed once, and returns one combined answer. No LLM sits in the money path.

<p align="center">
  <img src="docs/ui-home.jpg" alt="Homepage — Agents pay agents" width="900" />
</p>

- **Live app:** https://frontend-eight-peach-71.vercel.app
- **Backend (orchestrator + 4 agents):** https://defi-agents-backend.vercel.app — try [`/api/status`](https://defi-agents-backend.vercel.app/api/status)
- **Social:** [Instagram](https://www.instagram.com/p/DddzuxNMjkS/) · [X thread](https://x.com/ARakshe34041/status/2101283903952798016?s=20)

---

## Contents

1. [What happens when you run a task](#what-happens-when-you-run-a-task)
2. [The four agents](#the-four-agents)
3. [x402 payments, for real](#x402-payments-for-real)
4. [How this uses MagicBlock](#how-this-uses-magicblock)
5. [Architecture](#architecture)
6. [Contracts on Monad Testnet](#contracts-on-monad-testnet)
7. [Run it locally](#run-it-locally)
8. [Deploy to Vercel](#deploy-to-vercel)
9. [Environment variables](#environment-variables)
10. [Repository layout](#repository-layout)
11. [Monad Academy & soulbound credential](#monad-academy--soulbound-credential)
12. [Security notes & known limits](#security-notes--known-limits)
13. [Event recap](#event-recap)

---

## What happens when you run a task

```
 "Is token 0x534b… safe, audit it, track whales, is gas good?"
                         │
          ┌──────────────▼───────────────┐
          │ 1. Decompose  (regex + rules) │  no LLM decides where money goes
          └──────────────┬───────────────┘
                         │  for each specialist:
   2. Verify ── IdentityRegistryV2 (active? owner, payee) + StakeManagerV2 (stake)
               + ReputationRegistryV2 (independent and operator scores, kept apart)
   3. Quote  ── unpaid call → agent replies HTTP 402 with price, ITS OWN payee and the USDC EIP-712 domain
   4. Settle ── payer signs EIP-3009 to that payee → agent verifies → USDC.transferWithAuthorization
   5. Serve  ── agent reads live Monad data and returns its report
   6. Record ── ReputationRegistryV2.recordPaidCall(agentId, client, callId)   (only if USDC settled)
   7. Rate   ── Mode B: your wallet → submitFeedback(agentId, callId, score)   = independent review
               Mode A: orchestrator → submitFeedbackFor(agentId, callId, score) = operator review
                         │
          ┌──────────────▼───────────────┐
          │ 8. Synthesize (template)      │  every number comes from an agent
          └──────────────────────────────┘
```

Every step that touches the chain links to its transaction on MonadVision in the UI's dispatch log. A four-agent Mode A run measured on 2026-10-12 sent 12 transactions (4 settlements, 4 `recordPaidCall`, 4 operator reviews) costing **0.21 MON** in gas (Monad bills gas limit × price), plus **4 × $0.001 USDC** paid to four different agent payees.

<p align="center">
  <img src="docs/ui-console.jpg" alt="Work order console with dispatch log" width="900" />
</p>

---

## The four agents

| Nº | Agent | Path | What it actually computes | Data source |
|---|---|---|---|---|
| 01 | **Smart Contract Auditor** | `/agents/auditor/api/audit` | Resolves proxies (EIP-1967, ZeppelinOS, EIP-1822, EIP-1167), pulls verified source, runs static rules (tx.origin auth, reentrancy, unchecked calls, selfdestruct, weak randomness, unchecked ecrecover, overflow on <0.8), decodes runtime bytecode instruction-by-instruction for dangerous opcodes, lists privileged functions, scores 0–100 | Sourcify (Monad 10143), Monad RPC |
| 02 | **Token Risk Scorer** | `/agents/risk/api/score` | ABI-decodes name/symbol/supply, follows proxies to the implementation, detects mint / pause / blacklist / fee levers from the real selector table, checks owner (EOA vs contract), live `paused()`, scans 3,000 blocks of Transfer logs for recipient spread & concentration, returns a transparent score breakdown | Monad RPC (`eth_call`, `eth_getLogs`, storage slots) |
| 03 | **Gas & Timing Oracle** | `/agents/gas/api/gas` | 20-block fee history, real block utilisation from `gasUsedRatio`, base-fee trend, priority-fee percentiles, measured block time over 200 blocks, cost estimates for transfer / ERC-20 / swap, a send-now / wait verdict | Monad RPC (`eth_feeHistory`, blocks) |
| 04 | **Whale & Liquidity Sentinel** | `/agents/whale/api/whale` | Scans recent blocks for large native MON moves, or a token's Transfer logs for the top-5% transfers; classifies flow into contracts vs wallets; activity score | Monad RPC |

Every agent is registered in `IdentityRegistryV2` by **its own owner wallet**, with that wallet as its payee, and has staked 5 testnet USDC in `StakeManagerV2`. The router resolves each skill to its active agent id from the registry at runtime (60 s cache; `AGENT_IDS` can pin ids). Agent 04 is labelled "community": it is not one of the three skills the router was originally built around.

<p align="center">
  <img src="docs/ui-agents.jpg" alt="The four specialist agents" width="900" />
</p>

---

## x402 payments, for real

The marketplace uses Circle's testnet USDC on Monad (`0x534b…43A3`, a `FiatTokenV2_2` proxy), which supports **EIP-3009 `transferWithAuthorization`**.

1. A call without payment gets **HTTP 402** and the payment requirements: the agent's own **payee** and price, read from its `IdentityRegistryV2` record, and the token's real EIP-712 domain (read from chain: name **`USDC`**, version **`2`**).
2. The client (orchestrator in Mode A, your MetaMask in Mode B) reads `accepts[0].payTo` and the amount from that 402 and signs a `TransferWithAuthorization` **to that payee** with a fresh random nonce. The orchestrator refuses a 402 whose `payTo` isn't the registered payee, or whose price is above `MAX_PRICE_UNITS`.
3. The agent's middleware ([`agents/shared/x402Middleware.ts`](agents/shared/x402Middleware.ts)) checks the signature, payee, amount, validity window and nonce replay, then **submits the transfer onchain** and attaches the receipt. If it can't read the registry it fails closed (HTTP 503).
4. If the payer can't cover the amount, the call is still served but the receipt says `settled: false, status: "unfunded"`, and **no paid call is recorded**, so it can't be reviewed. Set `X402_REQUIRE_SETTLEMENT=true` to refuse unpaid calls instead.

> The EIP-712 domain name matters: signing with `"USD Coin"` produces `FiatTokenV2: invalid signature`. The code reads the name from the token so it can't drift.

**Modes:** Mode A — the orchestrator wallet pays, no wallet needed; it writes an *operator* review of each call it paid for. Mode B — toggle "Pay with my wallet": your browser does the 402 round trip, MetaMask signs one authorization per agent, and each result card offers a 1–5 star rating (mapped to 0–100) that your wallet submits as an *independent* review of that exact call.

### Reviews: independent vs operator

`ReputationRegistryV2` ties every review to one paid call (`callId`, random bytes32) and allows one review per call. A review from the wallet that paid is stored as **Client** and counts as independent. The agent's own owner or payee can't write one, and neither can any operator or recorder wallet. The orchestrator can only review calls it paid for itself; those are stored as **Operator**. The UI shows the two scores separately and ranks agents by independent score once they have at least 3 independent reviews. Below that it says "not enough independent reviews yet".

---

## How this uses MagicBlock

Switch the header to **MagicBlock** and the same four agents are paid on a **MagicBlock Ephemeral Rollup (ER)** on Solana devnet, by the Anchor program **`agent_market`**: [`AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu`](https://explorer.solana.com/address/AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu?cluster=devnet). All delegations are pinned to the devnet **US** ER (`MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd`, `devnet-us.magicblock.app`), the closest one to the Vercel backend (`iad1`).

It works like a payment channel built on ER delegation. Per-call activity is pure ER state, which has no per-transaction fee today. Real tokens move only at checkpoints.

```
 Solana devnet (base)                                   MagicBlock Ephemeral Rollup (US)
 ───────────────────                                    ────────────────────────────────
 register_agent ─ AgentProfile (owner, payee, price)
 stake ───────── stake vault (5 tUSDC per agent)
 open_tab ────── USDC → vault, Tab created
 delegate_tab / delegate_agent_stats / delegate_ledger ─────▶  Tab · AgentStats · Ledger cloned to the ER

                                                       pay_for_call  (1 tx, ~0.1 s from the backend)
                                                         · debit Tab, credit AgentStats.earned_total
                                                         · create CallReceipt  ← ephemeral account,
                                                           sponsored by the delegated Tab
                                                       submit_feedback (client = independent,
                                                         operator = operator) → closes the receipt
                                                       checkpoint  ← every 20 calls, or every 60 s via the
                                                         ER crank (ScheduleTask), or the backend auto-trigger
 commit (AgentStats + Tabs) ◀────── MagicIntentBundleBuilder: delegated Ledger pays,
 payout Magic Action ◀──────────────  magic_fee_vault path, + one post-commit action per agent
   vault ──▶ each agent's payee: earned_total − paid_total   (idempotent)
 undelegate_tab ◀────── commit_and_undelegate          close_tab: refund the unspent balance
```

**MagicBlock primitives used, all exercised on devnet:**

| Primitive | Where |
|---|---|
| **Delegation** (`#[delegate]`, pinned validator) | `Tab`, `AgentStats` and `Ledger` are delegated to the US ER; `AgentProfile` and the vaults stay on base |
| **Ephemeral Rollup execution** | `pay_for_call` and `submit_feedback` run on the ER: no fee, ~50–120 ms confirmations from the backend |
| **Ephemeral accounts** (`#[ephemeral_accounts]`) | One `CallReceipt` per paid call, sponsored by the client's delegated Tab. Reviewing the call closes it and returns the rent to the Tab. Never committed |
| **Commits** (`MagicIntentBundleBuilder`, delegated fee payer + `magic_fee_vault`) | `checkpoint` commits AgentStats and Tabs. The delegated `Ledger` PDA pays, so the market isn't capped at 10 commits per delegation |
| **Magic Actions** (`#[action]`, post-commit) | `payout` pays every agent what it earned since the last checkpoint, from the vault to its payee. It's idempotent (`earned_total − paid_total`) and refuses direct calls: the injected `escrow` must be a signer bound to the Ledger PDA, and `source_program` must be this program |
| **Cranks** (`ScheduleTask`) | The ER scheduler runs `checkpoint` every 60 s. It no-ops unless due, and the program rate-limits it, so it's safe to leave permissionless |
| **Magic Router / ER RPC** | Delegated accounts are read from the ER (`isBlockhashValid` checks payment freshness); base accounts from Solana |

**x402 over the ER (scheme `er-tab`).** An unpaid call to `/mb/agents/*` gets HTTP 402 with the agent's payee, its price, the program ID, the ER RPC and the validator. The payment is a base64 Solana transaction containing exactly one `pay_for_call`, signed by the client. [`agents/shared/x402ErMiddleware.ts`](agents/shared/x402ErMiddleware.ts) checks:
- the program ID
- the agent ID
- that the amount covers the price
- that `resource_hash` equals `sha256(method + path + body)` of *this* request
- the signatures
- that it carries a fresh ER blockhash

Only then does it submit the transaction to the ER and wait for confirmation. Settlement failure means 402; there is no "serve anyway" path on this rail. Mode A pays from the operator's Tab. In Mode B, Phantom or Solflare signs each `pay_for_call` from the user's own Tab, and the user rates the call from the same wallet, which stores an independent review.

**Evidence (devnet)**

| What | Transaction |
|---|---|
| ER payment from the live UI (`pay_for_call`, fee ◎0, creates the ephemeral receipt) | [`ekkSdcqp…`](https://explorer.solana.com/tx/ekkSdcqpQX1ZyhjGdUrdc3Fe7wFqqnq2UmhuxmNZ2sdwWU8boM7NZx71y9aDfh45HQnvkZnWBj2JmCGXH1Bpvxe?cluster=custom&customUrl=https%3A%2F%2Fdevnet-us.magicblock.app) (Explorer asks once to connect to the ER RPC) |
| Checkpoint commit + 4 `Payout` actions in one base tx (vault −3,000, three payees +1,000 each) | [`2QUckvAz…`](https://explorer.solana.com/tx/2QUckvAzVbqXMhGLieWvZFbxL5VVbWbudSesq9JhATMmziinccAc4VBc8Z1roWrRZPoiqresVuucFCGuVDSByRMf?cluster=devnet) |
| Commit and payout landing as separate base txs (an earlier checkpoint) | commit [`4YF2u77M…`](https://explorer.solana.com/tx/4YF2u77MJkUNuiYcEY17fmaSEeGxjtwRtnZCRekirc95spXwBJyh72EZhJYB9jCdo66kvgLMELRpSvju3wNH3jKS?cluster=devnet) · payout [`4cAuobod…`](https://explorer.solana.com/tx/4cAuobodtSYmECbKNdPrniLjGQ2wbJxgY3N5miU9EVZ7L4kSo4A49XqYG8DZFqqKNC7CyYYGE283pGkdq3UmeRyM?cluster=devnet) |
| Deployed accounts, agents, owners, payees, stake and seed transactions | [`solana/deployed.json`](solana/deployed.json) |

**Measured latency** (`pay_for_call`, send → confirmed):

| From | Median | Sample |
|---|---|---|
| Vercel backend (`iad1`) → US ER, live | **100 ms** (min 45, max 117) | 6 production payments, `/api/magicblock/metrics` |
| Live UI run via the backend | 54 – 116 ms per call | 4 calls |
| Test suite, local ER (`mb-stack`) | **23 ms** (min 15, max 447) | 50 calls, [`solana/test-results-localnet.json`](solana/test-results-localnet.json) |
| Test suite, devnet, from a laptop in India → US ER | **1,357 ms** (min 1,082, max 1,451) | 50 calls, [`solana/test-results-devnet.json`](solana/test-results-devnet.json) — two intercontinental round trips per call |

At the time of writing, 7.2 paid calls were folded into each base commit (`Ledger.total_calls ÷ checkpoints`). `/api/magicblock/metrics` serves these figures live. The "Why MagicBlock" section of the site shows only those live values.

**Tests:** [`solana/tests/agent-market.ts`](solana/tests/agent-market.ts) passes 17/17 on the local ER and 17/17 on devnet:
- the full lifecycle: register → stake → open_tab → delegate → 50× `pay_for_call` → client and operator reviews → checkpoint → payout observed on base → undelegate → refund
- replay
- insufficient tab balance
- underpayment
- feedback without a receipt
- double feedback
- the operator reviewing a client's call
- non-owner `update_agent`
- a direct call to the `payout` action

**Parity with the Monad side:**
- Every agent has its own owner and a payee token account, and ownership is transferable.
- Stake is real (5 tUSDC each in the stake vault).
- Reviews are split into independent and operator, and each is tied to one paid call.
- Nothing is seeded.
- **tUSDC** is a 6-decimal test mint created for this market. Circle's devnet USDC (`4zMMC9sr…`) works the same way, but needs faucet.circle.com.

**What still runs on Monad:**
- The agents' analysis: they audit Monad contracts, score Monad ERC-20s, read Monad gas and track Monad whales.
- Monad mode in full: IdentityRegistryV2 / ReputationRegistryV2 / StakeManagerV2 and x402 EIP-3009.
- The Academy credential.

MagicBlock replaces the payment, receipt, reputation and payout loop, not the data the agents analyse.

---

## Architecture

```
            Browser (Next.js 14, Vercel)
   ┌──────────────────────────────────────────┐
   │  pages: / · /about · /learn · /dashboard │
   │  /activity · /wallet · /marketplace      │──── reads registries & events directly via Monad RPC
   └───────────────┬──────────────────────────┘
                   │ HTTPS  (NEXT_PUBLIC_ORCHESTRATOR_URL)
   ┌───────────────▼──────────────────────────┐
   │ server.ts  — one Express app on Vercel    │
   │   /              orchestrator API         │── signs EIP-3009, records & rates onchain
   │   /agents/*      4 specialist agents      │── verify x402, settle USDC, read chain
   └───────────────┬──────────────────────────┘
                   │ JSON-RPC
            Monad Testnet (chain 10143)
   IdentityRegistry · ReputationRegistry · StakeManager · AcademyCredential · USDC
```

- **Frontend** (`frontend/`): Next.js App Router, Tailwind, Framer Motion, Lenis smooth scrolling. Design system: "Riso Ledger" — warm paper, ink, two risograph spot colours (violet `#5B3DF5`, flame `#FF5A1F`), Instrument Serif / Schibsted Grotesk / IBM Plex Mono, SVG risograph agent portraits.
- **Backend** (`server.ts`, `orchestrator/`, `agents/`): Express + ethers v6. Locally each service runs on its own port; on Vercel `server.ts` mounts them all on path prefixes, and the orchestrator reaches the agents over HTTP using the `*_URL` env vars.
- **Contracts** (`contracts/`): Solidity 0.8.24, Hardhat, OpenZeppelin.

### Orchestrator API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/status` | Operator address, live MON/USDC balances, registered agents with owner/payee/health |
| GET | `/api/chain-metrics` | Average block time over the last 200 blocks, latest block, timestamp (30 s cache) |
| POST | `/api/decompose` | Task → subtasks, annotated with registry status, stake and split reputation |
| POST | `/api/execute-step` | Pay + run one subtask (target URL taken from the registry), record the paid call with a `callId` |
| POST | `/api/orchestrate` | Mode A: decompose + execute all + synthesize in one call |
| POST | `/api/synthesize` | Combine agent results into the final answer |
| POST | `/api/feedback` | Operator review `{agentId, callId, score}` of a call the operator paid for |
| POST | `/api/register-agent` | Relay a registration: payee = `ownerAddress`, then ownership is transferred to it |
| POST | `/api/issue-credential` | Mint the soulbound Monad Scholar credential (owner-only, server-side) |

Write endpoints are rate-limited per IP on the public deployment.

---

## Contracts on Monad Testnet

### Current (v2)

| Contract | Address | Role |
|---|---|---|
| `IdentityRegistryV2` | [`0xfdeEE314eb3235a91e00a4EFFb76982F6F96e0C6`](https://testnet.monadvision.com/address/0xfdeEE314eb3235a91e00a4EFFb76982F6F96e0C6) | ERC-8004-style identity with a per-agent **payee** and **transferable ownership**; only the agent owner can change endpoint, price or payee; the contract owner keeps only an emergency `setActive` |
| `ReputationRegistryV2` | [`0x3A330F950E830f9e2DE8Dde90742D3459db6C54A`](https://testnet.monadvision.com/address/0x3A330F950E830f9e2DE8Dde90742D3459db6C54A) | Paid calls keyed by `callId`; one review per call; Client (independent) vs Operator reviews; `getReputation → (avgAll, countAll, avgIndependent, countIndependent)` |
| `StakeManagerV2` | [`0x498da2D83e2eC5b3D6FE2499B1dB17719E719da1`](https://testnet.monadvision.com/address/0x498da2D83e2eC5b3D6FE2499B1dB17719E719da1) | Per-agent USDC stake; `slash` restricted to the dispute resolver / owner |
| `AcademyCredential` | [`0xAbAFE53736e087877561cd0E48C283D6e7e59Ce6`](https://testnet.monadvision.com/address/0xAbAFE53736e087877561cd0E48C283D6e7e59Ce6) | Soulbound ERC-721 Monad Scholar credential |
| USDC (Circle, testnet) | [`0x534b2f3A21130d7a60830c2Df862319e593943A3`](https://testnet.monadvision.com/address/0x534b2f3A21130d7a60830c2Df862319e593943A3) | EIP-3009 payment token |
| **Operator** | [`0xE0754641302BB291F23E21766557Ce29c5642960`](https://testnet.monadvision.com/address/0xE0754641302BB291F23E21766557Ce29c5642960) | Owns the v2 contracts, is the authorized recorder, pays in Mode A and relays settlement gas |

**Agents (v2)**: each one was registered by its own wallet, which is also its payee, and staked 5 USDC. The USDC came from the operator's faucet.circle.com balance and was sent to each wallet, which then staked it itself. No reviews were seeded. Full deploy transactions are in [`contracts/deployed-addresses.json`](contracts/deployed-addresses.json).

| Nº | Agent | Owner = payee | Stake |
|---|---|---|---|
| 1 | Smart Contract Auditor | [`0xf7D58A474c3056B7719241fA2E52030ff680AdFE`](https://testnet.monadvision.com/address/0xf7D58A474c3056B7719241fA2E52030ff680AdFE) | 5 USDC |
| 2 | Token Risk Scorer | [`0xe5d9a3805aa1fb63A9f44d6D90068Ec6a50a6425`](https://testnet.monadvision.com/address/0xe5d9a3805aa1fb63A9f44d6D90068Ec6a50a6425) | 5 USDC |
| 3 | Gas Price & Transaction Timing Agent | [`0xFF8dE713385675ED6eA9A3f0c8dc65b22D980fBF`](https://testnet.monadvision.com/address/0xFF8dE713385675ED6eA9A3f0c8dc65b22D980fBF) | 5 USDC |
| 4 | Whale & Liquidity Sentinel | [`0xa611CAFAAAfC58C5151D03b98148aCF52ab2A5E7`](https://testnet.monadvision.com/address/0xa611CAFAAAfC58C5151D03b98148aCF52ab2A5E7) | 5 USDC |

### Legacy (v1) — retired

| Contract | Address | Why it was retired |
|---|---|---|
| `IdentityRegistry` | [`0xD62b32482874E447Beb60E6Df5A21E6ebaFf54ad`](https://testnet.monadvision.com/address/0xD62b32482874E447Beb60E6Df5A21E6ebaFf54ad) | Agents 1–4 are owned by the leaked, retired operator key, and v1 has no way to transfer agent ownership. Whoever holds that key can change their endpoint or price, or deactivate them. |
| `ReputationRegistry` | [`0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0`](https://testnet.monadvision.com/address/0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0) | `identityRegistry` is immutable (points at v1). Reviews weren't tied to individual calls, and operator-written reviews looked the same as client reviews. |
| `StakeManager` | [`0xca1624702029E9B76c648f980a673F37758aa45a`](https://testnet.monadvision.com/address/0xca1624702029E9B76c648f980a673F37758aa45a) | Points at v1 identity; every agent showed 0 stake |

Nothing reads v1 any more.

---

## Run it locally

**Requirements:** Node.js 20+, npm, a Monad Testnet wallet with a little MON for gas (and optionally testnet USDC from [faucet.circle.com](https://faucet.circle.com)).

```bash
git clone https://github.com/avishrakshe/Defi-Agents-On-monad-.git
cd Defi-Agents-On-monad-
cp .env.example .env          # then fill in ORCHESTRATOR_PRIVATE_KEY
```

**Option A — everything in one process (same as production):**

```bash
npm install                    # root: backend deps
npx ts-node server.ts          # http://localhost:8080
```

Set `CONTRACT_AUDITOR_URL=http://localhost:8080/agents/auditor`, `TOKEN_RISK_URL=…/agents/risk`, `GAS_TIMING_URL=…/agents/gas`, `WHALE_AGENT_URL=…/agents/whale` and point the frontend at port 8080 with `NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:8080`.

**Option B — separate services (ports 4000–4004):**

```bash
cd agents && npm install && npm start          # 4 agents on 4001–4004
cd orchestrator && npm install && npm start    # orchestrator on 4000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev                    # http://localhost:3000
```

On `localhost` the frontend talks to `http://localhost:4000` automatically; on any other host it uses the deployed backend unless `NEXT_PUBLIC_ORCHESTRATOR_URL` is set.

**Contracts (optional):**

```bash
cd contracts && npm install
npx hardhat test                                            # v1 + v2 suites
npx hardhat run scripts/deploy-v2.ts --network hardhat      # dry run
npx hardhat run scripts/deploy-v2.ts --network monadTestnet
```

`deploy-v2.ts` creates one owner wallet per agent and stores the keys in the git-ignored `contracts/.agent-wallets.json`. It prints only addresses. It then funds each wallet with 0.5 MON and 5 USDC from the operator, and each wallet registers its own agent (payee = itself) and stakes. Back up `.agent-wallets.json`: those keys are the only way to update or transfer the agents.

**Inspect live reputation from the CLI:**

```bash
node orchestrator/check-reputation.js
```

---

## Deploy to Vercel

Two Vercel projects from the same repo:

| Project | Root | How it builds |
|---|---|---|
| Frontend | `frontend/` | Next.js (auto-detected) |
| Backend | repo root | `vercel.json` routes every request to `server.ts` (`@vercel/node`); `.vercelignore` keeps `frontend/` and `contracts/` out |

```bash
# backend
vercel link --project defi-agents-backend
vercel env add ORCHESTRATOR_PRIVATE_KEY production --sensitive
vercel deploy --prod

# frontend
cd frontend
vercel env add NEXT_PUBLIC_ORCHESTRATOR_URL production   # https://<backend>.vercel.app
vercel deploy --prod
```

---

## Environment variables

**Backend** (`.env` locally, Vercel project settings in production)

| Variable | Required | Notes |
|---|---|---|
| `ORCHESTRATOR_PRIVATE_KEY` | yes | Operator key — signs Mode A payments, records calls, writes operator reviews, relays settlement gas. Store as a secret; never commit. |
| `NEXT_PUBLIC_MONAD_RPC_URL` | yes | `https://testnet-rpc.monad.xyz` |
| `NEXT_PUBLIC_MONAD_USDC_ADDRESS` | yes | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| `NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS`, `NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS`, `NEXT_PUBLIC_STAKE_MANAGER_ADDRESS` | yes | **v2** addresses from the table above |
| `CONTRACT_AUDITOR_URL`, `TOKEN_RISK_URL`, `GAS_TIMING_URL`, `WHALE_AGENT_URL` | no | Override an agent's onchain endpoint (local development). Unset → the registry endpoint is used |
| `AGENT_IDS` | no | Pin skills to agent ids, e.g. `contract-audit:1,token-risk-score:2,gas-timing:3,whale-tracker:4` |
| `MAX_PRICE_UNITS` | no | Most the orchestrator will pay per call in Mode A (default `10000` = $0.01) |
| `CHAIN` | no | Default network when a request has no `?chain=` (`monad` \| `magicblock`; default `monad`). Every API route accepts `?chain=magicblock` |
| `SOLANA_RPC_URL` | MagicBlock | Solana devnet base RPC (`https://rpc.magicblock.app/devnet`; the public RPC rate-limits bursts) |
| `MAGIC_ROUTER_URL` | MagicBlock | `https://devnet-router.magicblock.app` |
| `ER_RPC_URL` | MagicBlock | The pinned ER, `https://devnet-us.magicblock.app` |
| `ER_VALIDATOR` | MagicBlock | That ER's validator identity, `MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd` |
| `AGENT_MARKET_PROGRAM_ID` | MagicBlock | `AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu` |
| `USDC_MINT` | MagicBlock | The market's payment mint (tUSDC `HB4x6Kf2mbiS8LzuZSykJu85qo3CDfFNCiDDps2pmp5f`) |
| `SOLANA_OPERATOR_SECRET_KEY` | MagicBlock | JSON byte array of the market authority / Mode A operator. Secret — Vercel "sensitive" only |
| `CHECKPOINT_ADMIN_TOKEN` | no | `POST /api/checkpoint` with header `x-admin-token` forces a checkpoint; without it the program's own rate limit decides |
| `MB_AGENT_BASE_URL` | no | Local dev: reach MagicBlock agents at e.g. `http://localhost:8080/mb/agents` instead of their onchain endpoints |
| `X402_REQUIRE_SETTLEMENT` | no | `true` = refuse calls whose USDC payment can't settle |
| `SETTLEMENT_RELAYER_PRIVATE_KEY` | no | Separate key to pay gas for settlements (defaults to the operator) |
| `ETHERSCAN_API_KEY` | no | Extra verified-source fallback for the auditor |
| `OPENAI_API_KEY` | no | Optional wording polish of the final summary (numbers are never changed) |

**Frontend**

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_ORCHESTRATOR_URL` | Backend base URL |
| `NEXT_PUBLIC_ORCHESTRATOR_ADDRESS` | Operator address (Mode A payer shown in the console, balance display) |
| `NEXT_PUBLIC_DEFAULT_CHAIN` | `magicblock` makes MagicBlock the default network (the header switch is remembered per browser) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC for the browser wallet (default devnet); writes go through the backend relay |
| `NEXT_PUBLIC_MONAD_*`, contract addresses | Public chain configuration |

---

## Repository layout

```
├── server.ts                 # Vercel entry: orchestrator + 4 agents in one Express app
├── vercel.json, .vercelignore
├── orchestrator/src/
│   ├── server.ts             # HTTP API
│   ├── router.ts             # deterministic task decomposition
│   ├── executor.ts           # pay → call → record, shared by every mode
│   ├── x402Client.ts         # EIP-3009 signing against the token's real domain
│   └── synthesizer.ts        # template synthesis (+ optional polish)
├── agents/
│   ├── shared/x402Middleware.ts   # verify + settle USDC onchain
│   ├── shared/evm.ts              # disassembler, proxy resolver, ABI + chunked log helpers
│   ├── contract-auditor/      token-risk-scorer/      gas-timing-agent/
│   └── sample-custom-agent.ts     # Whale & Liquidity Sentinel (agent 04)
├── contracts/                # Solidity, Hardhat tests & deploy scripts
├── solana/                   # agent_market Anchor program (MagicBlock ER), IDL, tests, seed + WSL build/deploy scripts
│   ├── programs/agent_market/src/   # lib.rs (instructions), state.rs (accounts)
│   ├── tests/agent-market.ts        # local ER + devnet lifecycle and negative tests
│   └── deployed.json                # devnet addresses + seed transactions
└── frontend/src/
    ├── app/                  # pages
    ├── components/           # HeroSection, AgentLineup, TaskConsole, AgentResultCards, AgentPortrait, …
    └── lib/                  # contracts, wallet signing, onchain activity reader, smooth scroll
```

---

## Monad Academy & soulbound credential

Three learning paths — **Monad Fundamentals**, **Tokenized Assets**, **x402 Payments** — with lessons, quizzes and XP tracked on `/dashboard`. Completing all three unlocks the **Monad Scholar certificate**: export it as PNG or PDF, or mint it as a soulbound ERC-721 from `AcademyCredential`. Minting is owner-only, so the orchestrator signs it server-side; one credential per wallet.

<p align="center">
  <img src="docs/monad-scholar-certificate.png" alt="Monad Scholar certificate" width="720" />
</p>

---

## Security notes & known limits

**Fixed in v2 (Oct 2026)**

- **Leaked key no longer controls anything live.** An earlier version embedded the operator key in frontend code. That key (`0x39D1…C39B`) is retired and still sits in git history, so treat it as public. It owns the v1 agent records, and v1 can't transfer them, so the whole v1 set was replaced. In v2 every agent is owned by its own wallet. The leaked address appears nowhere in the code, and the frontend's fallback metadata claims no owner at all.
- **No more circular payments.** Each agent's 402 names its own registered payee, and the orchestrator and the browser both sign to that payee. A Mode A run settles USDC to four different addresses.
- **Real stake.** Each agent has 5 USDC staked by its owner wallet.
- **Reviews can't be faked as independent.** Reviews are tied to one settled, paid call each. Operator reviews are labelled and shown separately. Ranking uses only independent reviews.
- **`RecorderAuthorized` noise removed.** v1 emitted it on every recorded call. v2 emits it only when an authorization actually changes.

**Still open**

- **One team holds all four owner keys.** The four owner wallets are distinct onchain, but the same deployer generated them and holds them (`contracts/.agent-wallets.json`). They prove the mechanism (per-agent owner, payee, stake, transferable ownership), not independent operators. Transferring an agent to a real third party is one `transferAgentOwnership` call.
- **Independent ≠ Sybil-proof.** Any funded wallet that pays $0.001 for a call can review that call. The contract blocks the agent's own owner and payee and all operator wallets, but nothing stops a fresh wallet from paying for its own review.
- **The operator still relays settlement gas**: the agent middleware submits `transferWithAuthorization` with the operator key, acting as facilitator. It can't redirect funds, because the signed authorization fixes the payee.
- **`slash` has no dispute process** wired to it; only the owner or dispute resolver can call it.
- **Public write endpoints** are rate-limited per IP but not authenticated; anyone can trigger Mode A runs that spend operator gas.
- Agents read the public Monad RPC, which caps `eth_getLogs` at 100 blocks. Log scans are chunked and limited to recent windows (about 15 minutes).

**MagicBlock mode — known limits**

- **tUSDC, not Circle USDC.** Payments and stake use a test mint created for this market. The live site's faucet (`/api/magicblock/faucet`) gives 0.05 tUSDC per wallet every 6 hours.
- **One team holds every key.** The market authority (which is also the Mode A operator) and the four owner keypairs live in git-ignored `solana/.keys/`. Ownership is transferable onchain, but none has been transferred.
- **ER latency depends on distance.** The ~100 ms figure is backend (US) to US ER. A client far from the pinned region sees more: a laptop in India measured ~1.3 s.
- **Per-instance latency stats.** The ER confirm median in `/api/magicblock/metrics` comes from an in-memory buffer per backend instance. Every other metric there is read from chain.
- **The commit fee budget is finite.** Each commit after the first adds 1,000,000 lamports to the delegation's cleanup charge. The Ledger pays live fees from commit 26 onward and must be topped up eventually.
- **Not built:** session keys, private (TEE) tabs, Solana-native specialists, VRF cross-checks and the base-vs-ER comparison (B7–B8). `slash` exists but has no dispute process behind it.

---

## Event recap

Highlights from the **Monad community event & ecosystem showcase** — builders, Monad Scholar certificates, and live agent-to-agent payments on Monad:

<p align="center">
  <img src="docs/demo.gif" alt="Monad community event recap" width="850" />
</p>

- [Instagram reel](https://www.instagram.com/p/DddzuxNMjkS/) · [X thread](https://x.com/ARakshe34041/status/2101283903952798016?s=20)

---

## Disclaimer

Built for the Monad ecosystem. This is an independent open-source project and **not** an official Monad Labs product unless otherwise stated. All trademarks belong to their respective owners. Testnet only — no real funds.

## License

MIT — see [LICENSE](LICENSE).
