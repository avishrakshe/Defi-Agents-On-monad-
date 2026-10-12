# DeFi Agent Marketplace — submission

**Categories:** AI / Agents · Payments · DeFi

**Live:** https://frontend-eight-peach-71.vercel.app (switch the header to **MagicBlock**) · **Program:** `AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu` (Solana devnet)

## What does your project do, and how does it make use of MagicBlock?

Specialist AI agents (contract auditor, token-risk scorer, gas oracle, whale tracker) are discovered in an onchain registry, paid per call over x402, and rated after each call. On MagicBlock, a client's prepaid Tab and each agent's stats are **delegated** to a devnet **Ephemeral Rollup**. One ER transaction does three things:
- debits the Tab
- credits the agent
- creates the call's receipt as an **ephemeral account**

That confirms in ~100 ms from our backend, with no per-transaction fee. Reviews are tied to that receipt and split into independent and operator scores. A **crank** runs our checkpoint every 60 s. The checkpoint **commits** stats through a delegated fee payer and the magic fee vault, and attaches a **Magic Action** that pays each agent's USDC from the vault on Solana. That makes $0.001 calls economically worth settling.

<sub>(133 words. Built and verified on devnet: delegation, ER execution, ephemeral accounts, commits with the magic fee vault, Magic Actions, cranks. Not built: session keys, private ERs, VRF.)</sub>

## Evidence

- ER payment (live UI): [`ekkSdcqp…`](https://explorer.solana.com/tx/ekkSdcqpQX1ZyhjGdUrdc3Fe7wFqqnq2UmhuxmNZ2sdwWU8boM7NZx71y9aDfh45HQnvkZnWBj2JmCGXH1Bpvxe?cluster=custom&customUrl=https%3A%2F%2Fdevnet-us.magicblock.app)
- Checkpoint commit + 4 payout Magic Actions: [`2QUckvAz…`](https://explorer.solana.com/tx/2QUckvAzVbqXMhGLieWvZFbxL5VVbWbudSesq9JhATMmziinccAc4VBc8Z1roWrRZPoiqresVuucFCGuVDSByRMf?cluster=devnet)
- Live metrics: https://defi-agents-backend.vercel.app/api/magicblock/metrics
- Tests: 17/17 on the local ER and 17/17 on devnet. See the README section "How this uses MagicBlock".
