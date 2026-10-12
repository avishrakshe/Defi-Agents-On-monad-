# Demo video script — DeFi Agent Marketplace (Monad + MagicBlock)

**Target length:** 3:00. Trims for a 2:00 cut are marked ✂.
**Format:** screen recording at 1920×1080, with a voiceover recorded live or added afterwards.
**Rule:** every number you say should be on screen at that moment. The site only shows measured values, so read what it shows rather than the numbers in this script.

---

## Before you record (≈10 min)

**Browser**
- Use Chrome at 1920×1080 with the bookmarks bar hidden and zoom at 90–100%. Use a clean profile or incognito plus your wallet extensions.
- Open these tabs in order:
  1. https://frontend-eight-peach-71.vercel.app (hard-refresh with Ctrl+Shift+R so you get the latest build)
  2. https://defi-agents-backend.vercel.app/api/magicblock/metrics
  3. https://explorer.solana.com/address/AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu?cluster=devnet
  4. https://testnet.monadvision.com/address/0xfdeEE314eb3235a91e00a4EFFb76982F6F96e0C6
- Open any ER transaction link once and click **Connect** on Solana Explorer's "Connect to this RPC server?" prompt, so it doesn't appear on camera. This one works: https://explorer.solana.com/tx/ekkSdcqpQX1ZyhjGdUrdc3Fe7wFqqnq2UmhuxmNZ2sdwWU8boM7NZx71y9aDfh45HQnvkZnWBj2JmCGXH1Bpvxe?cluster=custom&customUrl=https%3A%2F%2Fdevnet-us.magicblock.app

**Warm everything up** (serverless cold starts look slow on camera)
- Load https://defi-agents-backend.vercel.app/api/status and `.../api/status?chain=magicblock` twice each.
- Do one full dry run per network in the Task Console. Each Monad run costs the operator about 0.21 MON and 4 × $0.001 USDC; MagicBlock runs cost ~0.004 tUSDC and no fees.

**Wallets** (only needed for the optional Mode B scenes)
- **MetaMask** on Monad Testnet with a little MON and some testnet USDC from faucet.circle.com (Monad).
- **Phantom** on **devnet**. In the site's MagicBlock mode, click *Get test tUSDC* and then *Open tab* **before** recording, and do one full rehearsal of this flow. It's built but hasn't yet been run end to end with a real wallet; if it misbehaves, cut scene 8.

**During recording**
- Keep the site tab **in the foreground**. Background tabs throttle timers, so the answer types out slowly and the settlement panel updates late.
- After a MagicBlock run, the "Settlement to Solana" panel appears when the next checkpoint lands, which takes up to about 60 s (the ER crank runs every 60 s). **Keep recording and cut the wait in the edit**, or say the line in scene 7 while you wait.
- Start in **Monad** mode (click Monad in the header switch).

---

## Scene 1 — Hook (0:00–0:15)

**On screen:** the homepage hero ("Agents pay agents."), then a slow scroll to the agent board.

**Say:**
> "AI agents are going to hire other AI agents — and pay them per call. This is a marketplace where specialist agents are discovered onchain, paid a tenth of a cent per request, and rated after every call. It runs on two networks: Monad, and MagicBlock's Ephemeral Rollups on Solana."

---

## Scene 2 — What's on the board (0:15–0:35)

**On screen:** the hero agent board, then scroll to **The agent ledger** (registry table). Hover an owner address.

**Say:**
> "Four specialists: a contract auditor, a token-risk scorer, a gas oracle and a whale tracker. Each one is registered by its own wallet, gets paid at its own payee, and has real USDC staked. Reviews are split in two. Independent reviews come from wallets that paid for the call; operator reviews come from our own orchestrator, and they're shown apart. An agent is only ranked once it has three independent reviews, so the board says 'not enough independent reviews yet' instead of showing a flattering number."

✂ For the 2:00 cut, drop the last sentence.

---

## Scene 3 — A paid run on Monad (0:35–1:05)

**On screen:** scroll to **Run a task**, leave the default "Full scan" prompt, click **Run task →**, and let the dispatch log stream.

**Say** (while it runs):
> "I'll ask one question: is this token safe, is the contract sound, any whale moves, is gas good. A deterministic router — no LLM in the money path — splits it into four calls. For each one the agent answers HTTP 402 with its price and its own payee, the orchestrator signs an EIP-3009 USDC authorization to that payee, and the agent settles it onchain before doing the work."

**On screen:** point at one finished line: *payee → USDC settled ↗ → recorded ↗ → op. review ↗*. Click **USDC settled ↗** so MonadVision opens, then come back.

**Say:**
> "Every line is a real transaction on Monad testnet: the payment, the paid call recorded under a unique call ID, and the operator's review of that exact call."

---

## Scene 4 — Honest numbers (1:05–1:15) ✂ optional

**On screen:** scroll to **Why Monad**. Point at the Block time figure and its footnote.

**Say:**
> "The block time here isn't hard-coded — it's measured live over the last 200 blocks."

---

## Scene 5 — Switch to MagicBlock (1:15–1:30)

**On screen:** click **MagicBlock** in the header switch. The masthead changes to *MagicBlock edition · Solana devnet + Ephemeral Rollup*, and the board reloads with the Solana agents.

**Say:**
> "Same agents, different rail. On Monad every call settles in its own block. On MagicBlock, the client's prepaid Tab and each agent's stats are delegated to an Ephemeral Rollup, so a call is paid, receipted and scored in one rollup transaction — and real tokens only move to Solana in batches."

---

## Scene 6 — A paid run on the Ephemeral Rollup (1:30–2:05)

**On screen:** run the same task. Zoom in on the dispatch log as the lines land: *ER payment ↗ ~100 ms · receipt … (ephemeral) · op. review ↗*.

**Say:**
> "Each payment is one pay_for_call on the rollup: it debits the Tab, credits the agent, and creates a receipt as an ephemeral account. Look at the confirmation time — around a hundred milliseconds, with no transaction fee. The receipt lives only on the rollup; reviewing the call closes it and returns the rent."

**On screen:** click one **ER payment ↗**. In Solana Explorer, point at **Fee ◎0**, the **PayForCall** log, and **Created ephemeral: 113 bytes**. Go back.

---

## Scene 7 — Settlement to Solana (2:05–2:35)

**On screen:** the **Settlement to Solana** panel shows *waiting…*, then *commit ↗* and *payout #1–#4 ↗*. Cut the wait in the edit. Click **commit ↗**.

**Say:**
> "Every twenty calls — or every sixty seconds, driven by a crank on the rollup itself — a checkpoint commits the agents' earnings back to Solana through a delegated fee payer. Attached to that commit is a Magic Action that pays each agent what it earned, from the vault straight to its payee. It's idempotent: run it twice and it pays zero the second time. So a tenth-of-a-cent call is actually worth settling."

**On screen** (in Explorer): point at the token balance changes. The vault goes down and the payees go up.

---

## Scene 8 — Pay from your own wallet (2:35–2:50) ✂ optional; only if rehearsed

**On screen:** toggle **Pay from my own Tab**. Show the Tab panel (status: open on ER, available balance). Run a short task, e.g. the **Gas now** chip, approve the Phantom popup, then rate the call with **★★★★★** on its field report and approve the second popup.

**Say:**
> "Or pay from your own Tab: your wallet signs each payment, and because you paid for the call, your rating counts as an independent review."

(The Monad version works the same way with MetaMask.)

---

## Scene 9 — Close (2:50–3:00)

**On screen:** scroll to **Why MagicBlock**. The four live figures are the median ER confirm, calls per base commit, tUSDC paid out to agents, and fee per ER transaction. End on the hero or the logo.

**Say:**
> "Every number on this page is read live. Agents that pay agents — on Monad, and on MagicBlock's Ephemeral Rollups."

---

## If something goes wrong on camera

| Symptom | What to do |
|---|---|
| A step shows **failed** | The run continues with the other agents. Narrate it ("one specialist failed, the rest still settle") or re-record the scene. |
| The Monad run is slow on the first agent | That's a cold start. Re-run; it's fast once warm. |
| The settlement panel says *waiting…* for a while | That's normal: the next checkpoint is due within 60 s. Keep recording and cut. |
| It says *no new checkpoint observed within 150 s* | Open tab 2 (`/api/magicblock/metrics`) and show `lastCommit` and `payouts` instead. |
| The Why MagicBlock "median confirm" shows "—" | The backend instance restarted. Do one MagicBlock run first; it fills in. |
| The Phantom popup fails | Cut scene 8. Mode A already shows the whole loop. |

## Facts you can say safely (all verified)

- Monad mode uses IdentityRegistryV2 / ReputationRegistryV2 / StakeManagerV2 on Monad testnet. Each of the 4 agents has its own owner and payee and 5 USDC staked.
- MagicBlock mode uses the `agent_market` program `AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu` on Solana devnet and the US Ephemeral Rollup.
- ER payment confirm measured from the backend: median ≈100 ms. From the live UI: 54–116 ms per call. Fee: 0.
- The test suite passes 17/17 on the local ER and 17/17 on devnet.
- MagicBlock primitives used: delegation, ER execution, ephemeral accounts, commits through a delegated fee payer and the magic fee vault, Magic Actions, cranks.
- Payments on the MagicBlock rail use **tUSDC**, a test mint created for this market. Say "test USDC" rather than "USDC" in that scene.

**Don't say** that the agents' analysis runs on Solana: it reads Monad data in both modes. Also don't mention session keys, private rollups or VRF; they aren't built.
