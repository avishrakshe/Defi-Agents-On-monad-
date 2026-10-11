# DeFi Agent Marketplace — Monad Testnet

[![Live site](https://img.shields.io/badge/Live-frontend--eight--peach--71.vercel.app-16130F?style=flat-square)](https://frontend-eight-peach-71.vercel.app)
[![Backend](https://img.shields.io/badge/API-defi--agents--backend.vercel.app-5B3DF5?style=flat-square)](https://defi-agents-backend.vercel.app/api/status)
[![Monad Testnet](https://img.shields.io/badge/Monad_Testnet-chain_10143-836EF9?style=flat-square)](https://testnet.monadvision.com)
[![x402](https://img.shields.io/badge/x402-EIP--3009_USDC-FF5A1F?style=flat-square)](https://x402.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-identity_%2B_reputation-1E7A46?style=flat-square)](https://testnet.monadvision.com/address/0xD62b32482874E447Beb60E6Df5A21E6ebaFf54ad)

**Specialist AI agents that discover each other, check reputation onchain, pay per call in USDC and rate the result — all inside one request, on Monad.**

Ask a question in plain language ("is this token safe, and is gas good right now?"). The orchestrator splits it into subtasks, verifies each specialist against the onchain registries, pays it **$0.001 USDC per call via x402 / EIP-3009**, collects real chain data, writes a review score back onchain, and returns one combined answer. No LLM sits in the money path.

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
4. [Architecture](#architecture)
5. [Contracts on Monad Testnet](#contracts-on-monad-testnet)
6. [Run it locally](#run-it-locally)
7. [Deploy to Vercel](#deploy-to-vercel)
8. [Environment variables](#environment-variables)
9. [Repository layout](#repository-layout)
10. [Monad Academy & soulbound credential](#monad-academy--soulbound-credential)
11. [Security notes & known limits](#security-notes--known-limits)
12. [Event recap](#event-recap)

---

## What happens when you run a task

```
 "Is token 0x534b… safe, audit it, track whales, is gas good?"
                         │
          ┌──────────────▼───────────────┐
          │ 1. Decompose  (regex + rules) │  no LLM decides where money goes
          └──────────────┬───────────────┘
                         │  for each specialist:
   2. Verify ── IdentityRegistry (active?) + ReputationRegistry (avg score, reviews)
   3. Quote  ── agent replies HTTP 402 with price + USDC EIP-712 domain
   4. Settle ── orchestrator signs EIP-3009 → agent verifies → USDC.transferWithAuthorization
   5. Serve  ── agent reads live Monad data and returns its report
   6. Record ── ReputationRegistry.recordPaidCall(agentId, client)
   7. Rate   ── ReputationRegistry.submitFeedbackFor(agentId, score)  (quality score)
                         │
          ┌──────────────▼───────────────┐
          │ 8. Synthesize (template)      │  every number comes from an agent
          └──────────────────────────────┘
```

Every step that touches the chain links to its transaction on MonadVision in the UI's dispatch log. A full four-agent run costs about **0.12 MON** in gas plus **4 × $0.001 USDC**.

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

Agent 04 is a "community" agent: it is discovered from `IdentityRegistry` at runtime rather than hard-wired into the router.

<p align="center">
  <img src="docs/ui-agents.jpg" alt="The four specialist agents" width="900" />
</p>

---

## x402 payments, for real

The marketplace uses Circle's testnet USDC on Monad (`0x534b…43A3`, a `FiatTokenV2_2` proxy), which supports **EIP-3009 `transferWithAuthorization`**.

1. A call without payment gets **HTTP 402** and the payment requirements, including the token's real EIP-712 domain (read from chain: name **`USDC`**, version **`2`**).
2. The client (orchestrator in Mode A, your MetaMask in Mode B) signs a `TransferWithAuthorization` with a fresh random nonce.
3. The agent's middleware ([`agents/shared/x402Middleware.ts`](agents/shared/x402Middleware.ts)) checks the signature, payee, amount, validity window and nonce replay, then **submits the transfer onchain** and attaches the receipt.
4. If the payer can't cover the amount, the call is still served but the receipt says `settled: false, status: "unfunded"` — nothing is faked. Set `X402_REQUIRE_SETTLEMENT=true` to refuse unpaid calls instead.

> The EIP-712 domain name matters: signing with `"USD Coin"` produces `FiatTokenV2: invalid signature`. The code reads the name from the token so it can't drift.

**Modes:** Mode A — the orchestrator wallet pays, no wallet needed. Mode B — toggle "Pay with my wallet" and MetaMask signs one authorization per agent (unique nonces, never reused).

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
| GET | `/api/status` | Operator address, live MON/USDC balances, agent health |
| POST | `/api/decompose` | Task → subtasks, annotated with registry status and reputation |
| POST | `/api/execute-step` | Pay + run one subtask, record the paid call onchain |
| POST | `/api/orchestrate` | Decompose + execute all + synthesize in one call |
| POST | `/api/synthesize` | Combine agent results into the final answer |
| POST | `/api/feedback` | Write a review score to ReputationRegistry |
| POST | `/api/register-agent` | Register a new agent in IdentityRegistry |
| POST | `/api/issue-credential` | Mint the soulbound Monad Scholar credential (owner-only, server-side) |

Write endpoints are rate-limited per IP on the public deployment.

---

## Contracts on Monad Testnet

| Contract | Address | Role |
|---|---|---|
| `IdentityRegistry` | [`0xD62b32482874E447Beb60E6Df5A21E6ebaFf54ad`](https://testnet.monadvision.com/address/0xD62b32482874E447Beb60E6Df5A21E6ebaFf54ad) | ERC-8004-style agent identity: name, skill, endpoint, price, metadata |
| `ReputationRegistry` | [`0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0`](https://testnet.monadvision.com/address/0x7b398a8F83133d5E28b4cce7c3131b4Ba8C486E0) | Paid-call records and review scores per agent |
| `StakeManager` | [`0xca1624702029E9B76c648f980a673F37758aa45a`](https://testnet.monadvision.com/address/0xca1624702029E9B76c648f980a673F37758aa45a) | Operator USDC stake and slashing |
| `AcademyCredential` | [`0xAbAFE53736e087877561cd0E48C283D6e7e59Ce6`](https://testnet.monadvision.com/address/0xAbAFE53736e087877561cd0E48C283D6e7e59Ce6) | Soulbound ERC-721 Monad Scholar credential |
| USDC (Circle, testnet) | [`0x534b2f3A21130d7a60830c2Df862319e593943A3`](https://testnet.monadvision.com/address/0x534b2f3A21130d7a60830c2Df862319e593943A3) | EIP-3009 payment token |
| **Operator** (owner of all four contracts) | [`0xE0754641302BB291F23E21766557Ce29c5642960`](https://testnet.monadvision.com/address/0xE0754641302BB291F23E21766557Ce29c5642960) | Pays specialists in Mode A, records calls and reviews |

---

## Run it locally

**Requirements:** Node.js 20+, npm, a Monad Testnet wallet with a little MON for gas (and optionally testnet USDC from [faucet.circle.com](https://faucet.circle.com)).

```bash
git clone https://github.com/avishrakshe/Defi-Agents-On-monad-.git
cd Defi-Agents-On-monad-
cp .env.example .env          # then fill in ORCHESTRATOR_PRIVATE_KEY and PAY_TO_ADDRESS
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
npx hardhat test
npx hardhat run scripts/deploy-and-seed.ts --network monadTestnet
```

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
| `ORCHESTRATOR_PRIVATE_KEY` | yes | Operator key — signs payments, records calls, writes reviews. Store as a secret; never commit. |
| `PAY_TO_ADDRESS` | yes | Address the agents require payments to be made out to |
| `NEXT_PUBLIC_MONAD_RPC_URL` | yes | `https://testnet-rpc.monad.xyz` |
| `NEXT_PUBLIC_MONAD_USDC_ADDRESS` | yes | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| `NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS` etc. | yes | Contract addresses from the table above |
| `CONTRACT_AUDITOR_URL`, `TOKEN_RISK_URL`, `GAS_TIMING_URL`, `WHALE_AGENT_URL` | yes | Where the orchestrator reaches each agent |
| `X402_REQUIRE_SETTLEMENT` | no | `true` = refuse calls whose USDC payment can't settle |
| `SETTLEMENT_RELAYER_PRIVATE_KEY` | no | Separate key to pay gas for settlements (defaults to the operator) |
| `ETHERSCAN_API_KEY` | no | Extra verified-source fallback for the auditor |
| `OPENAI_API_KEY` | no | Optional wording polish of the final summary (numbers are never changed) |

**Frontend**

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_ORCHESTRATOR_URL` | Backend base URL |
| `NEXT_PUBLIC_ORCHESTRATOR_ADDRESS` | Operator address (Mode B payee, balance display) |
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

- **Operator key rotation (Oct 2026).** An earlier version embedded the operator key in frontend code. That key (`0x39D1…C39B`) is retired: ownership of all four contracts moved to `0xE075…2960`, and the key no longer appears anywhere in the code. It still exists in git history — treat it as public.
- **Agent records 1–4** still list the retired wallet as their per-agent owner in `IdentityRegistry` (the contract has no owner-transfer for agents). The backend therefore routes to its own configured agent URLs instead of trusting those records. A registry upgrade would close this fully.
- **Payee.** All agents currently share one payee (the operator), so settlements are real but circular. Give each agent its own `PAY_TO_ADDRESS` to route value to agent owners.
- **Public write endpoints** are rate-limited per IP but not authenticated; anyone can trigger runs that spend operator gas.
- Agents read the public Monad RPC, which caps `eth_getLogs` at 100 blocks — log scans are chunked and limited to recent windows (about 16 minutes).

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
