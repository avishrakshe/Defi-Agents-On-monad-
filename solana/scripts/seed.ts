/**
 * Seed agent_market on devnet: four agents, each registered by its own owner keypair with its own payee token account
 * and 5 tUSDC of stake; AgentStats delegated to the pinned ER; the operator's Mode A Tab opened and delegated; the
 * checkpoint crank scheduled. No reviews are seeded. Writes every address and signature to solana/deployed.json.
 *
 *   . scripts/devnet-env.sh && npx ts-node -P tsconfig.json scripts/seed.ts
 */
import { BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import {
  base,
  er,
  ER_URL,
  NETWORK,
  PROGRAM_ID,
  VALIDATOR,
  DELEGATION_PROGRAM_ID,
  checkpointFixedAccounts,
  ensureMarket,
  fundSol,
  isDelegated,
  keyFile,
  loadKeypair,
  mintTUsdc,
  programFor,
  seeds,
  sendErTimed,
  sleep,
  tokenAccount,
  waitForOwner
} from "./common";

const BACKEND = (process.env.BACKEND_PUBLIC_URL || "https://defi-agents-backend.vercel.app").replace(/\/$/, "");
const STAKE = 5_000_000; // 5 tUSDC
const OPERATOR_TAB = 2_000_000; // 2 tUSDC prepaid for Mode A
const AGENTS = [
  { key: "contract-audit", name: "Smart Contract Auditor", path: "auditor/api/audit", description: "Static security analysis of verified Monad Testnet contracts." },
  { key: "token-risk-score", name: "Token Risk Scorer", path: "risk/api/score", description: "ERC-20 risk: owner privileges, mint/freeze backdoors, holder concentration." },
  { key: "gas-timing", name: "Gas Price & Transaction Timing Agent", path: "gas/api/gas", description: "Fee oracle with measured block time and a send-now / wait verdict." },
  { key: "whale-tracker", name: "Whale & Liquidity Sentinel", path: "whale/api/whale", description: "Large MON or token moves, classified by where the size flows." }
];

async function main() {
  const authority = loadKeypair(process.env.AUTHORITY_KEYPAIR!);
  const txs: Record<string, string> = {};
  const p = programFor(base, authority);
  console.log(`network ${NETWORK} · program ${PROGRAM_ID.toBase58()} · validator ${VALIDATOR.toBase58()} · authority ${authority.publicKey.toBase58()}`);

  const { mint } = await ensureMarket(authority, { operator: authority.publicKey, everyCalls: 20, everySecs: 60, cooldownSecs: 3600 });
  console.log(`tUSDC mint ${mint.toBase58()} (6 decimals, mint authority = market authority)`);

  const config = await p.account.config.fetch(seeds.config());
  const existing = await Promise.all(
    Array.from({ length: config.agentCount.toNumber() }, (_, i) => p.account.agentProfile.fetch(seeds.agent(i + 1)))
  );

  const out: any[] = [];
  for (const a of AGENTS) {
    const owner = keyFile(`owners/${a.key}`);
    const payee = await tokenAccount(authority, mint, owner.publicKey);
    let prof = existing.find((e) => e.skill === a.key && e.active && e.owner.equals(owner.publicKey));
    let id: number;
    if (prof) {
      id = prof.agentId.toNumber();
      console.log(`#${id} ${a.key} already registered`);
    } else {
      const f = await fundSol(authority, owner.publicKey, 0.06);
      if (f) txs[`fundSol:${a.key}`] = f;
      const cfg = await p.account.config.fetch(seeds.config());
      id = cfg.agentCount.toNumber() + 1;
      txs[`register:${a.key}`] = await programFor(base, owner)
        .methods.registerAgent(
          new BN(id),
          a.name,
          a.key,
          `${BACKEND}/mb/agents/${a.path}`,
          new BN(1000),
          JSON.stringify({ description: a.description, priceUSDC: "$0.001", rail: "MagicBlock ER (tUSDC)" })
        )
        .accountsPartial({ owner: owner.publicKey, payee })
        .rpc();
      prof = await p.account.agentProfile.fetch(seeds.agent(id));
    }
    if (prof.stake.toNumber() < STAKE) {
      const bal = Number((await getAccount(base, payee)).amount);
      if (bal < STAKE) txs[`mint:${a.key}`] = await mintTUsdc(authority, mint, payee, STAKE - bal);
      txs[`stake:${a.key}`] = await programFor(base, owner)
        .methods.stake(new BN(STAKE - prof.stake.toNumber()))
        .accountsPartial({ owner: owner.publicKey, agentProfile: seeds.agent(id), ownerToken: payee, tokenProgram: TOKEN_PROGRAM_ID })
        .rpc();
    }
    if (!(await isDelegated(seeds.stats(id)))) {
      txs[`delegateStats:${a.key}`] = await p.methods.delegateAgentStats(new BN(id)).accountsPartial({ authority: authority.publicKey, validator: VALIDATOR }).rpc();
      await waitForOwner(seeds.stats(id), DELEGATION_PROGRAM_ID);
    }
    const final = await p.account.agentProfile.fetch(seeds.agent(id));
    out.push({
      id,
      skill: a.key,
      name: a.name,
      owner: owner.publicKey.toBase58(),
      payee: payee.toBase58(),
      stakeUnits: final.stake.toNumber(),
      endpoint: final.endpoint,
      agentProfile: seeds.agent(id).toBase58(),
      agentStats: seeds.stats(id).toBase58(),
      agentPayout: seeds.payout(id).toBase58()
    });
    console.log(`#${id} ${a.key} owner ${owner.publicKey.toBase58()} payee ${payee.toBase58()} stake ${final.stake.toNumber() / 1e6} tUSDC`);
  }

  // Operator's own Tab for Mode A
  const opTab = seeds.tab(authority.publicKey);
  if (!(await isDelegated(opTab))) {
    const opToken = await tokenAccount(authority, mint, authority.publicKey);
    const bal = Number((await getAccount(base, opToken)).amount);
    if (bal < OPERATOR_TAB) txs.mintOperator = await mintTUsdc(authority, mint, opToken, OPERATOR_TAB - bal);
    txs.openOperatorTab = await p.methods
      .openTab(new BN(OPERATOR_TAB), new BN(0.05 * LAMPORTS_PER_SOL))
      .accountsPartial({ client: authority.publicKey, clientToken: opToken, tokenProgram: TOKEN_PROGRAM_ID })
      .rpc();
    txs.delegateOperatorTab = await p.methods.delegateTab().accountsPartial({ client: authority.publicKey, validator: VALIDATOR }).rpc();
    await waitForOwner(opTab, DELEGATION_PROGRAM_ID);
  }

  // Let the ER clone the delegated accounts before scheduling the crank against them
  for (let i = 0; i < 30 && !(await er.getAccountInfo(seeds.ledger())); i++) await sleep(1000);

  // Crank: run `checkpoint` (no-op unless due) every 60s for a day
  const taskId = Number(process.env.CRANK_TASK_ID || Date.now() % 2 ** 40);
  const fixed = checkpointFixedAccounts();
  const rem = [
    { pubkey: fixed.ledger, isSigner: false, isWritable: true },
    { pubkey: fixed.config, isSigner: false, isWritable: false },
    { pubkey: fixed.magicFeeVault, isSigner: false, isWritable: true },
    { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: PROGRAM_ID, isSigner: false, isWritable: false }, // caller: None
    { pubkey: fixed.magicProgram, isSigner: false, isWritable: false },
    { pubkey: fixed.magicContext, isSigner: false, isWritable: true },
    ...out.flatMap((a) => [
      { pubkey: new PublicKey(a.agentStats), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(a.agentProfile), isSigner: false, isWritable: false }
    ]),
    { pubkey: opTab, isSigner: false, isWritable: true }
  ];
  let crank: any = { taskId, intervalMs: 60_000, iterations: 1440 };
  try {
    const ix = await programFor(er, authority)
      .methods.scheduleCheckpoints(new BN(taskId), new BN(60_000), new BN(1440), out.length)
      .accountsPartial({ authority: authority.publicKey })
      .remainingAccounts(rem)
      .instruction();
    const { sig } = await sendErTimed(new Transaction().add(ix), [authority]);
    crank.scheduleSig = sig;
    console.log(`crank scheduled: task ${taskId}, ER tx ${sig}`);
  } catch (e: any) {
    crank.error = e.message.split("\n").slice(0, 6).join(" | ");
    console.log(`crank scheduling FAILED: ${crank.error}`);
  }

  const file = path.resolve(__dirname, "../deployed.json");
  const deployed = {
    network: "solana-devnet",
    programId: PROGRAM_ID.toBase58(),
    erRpc: ER_URL,
    validator: VALIDATOR.toBase58(),
    router: process.env.MAGIC_ROUTER_URL || "https://devnet-router.magicblock.app",
    usdcMint: mint.toBase58(),
    usdcLabel: "tUSDC — 6-decimal test mint created for this market (Circle devnet USDC needs faucet.circle.com)",
    authority: authority.publicKey.toBase58(),
    accounts: {
      config: seeds.config().toBase58(),
      ledger: seeds.ledger().toBase58(),
      vault: seeds.vault().toBase58(),
      stakeVault: seeds.stakeVault().toBase58(),
      operatorTab: opTab.toBase58()
    },
    checkpoint: { everyCalls: 20, everySecs: 60 },
    agents: out,
    crank,
    transactions: txs,
    seededAt: new Date().toISOString(),
    reviewsSeeded: 0
  };
  fs.writeFileSync(file, JSON.stringify(deployed, null, 2));
  console.log(`wrote ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
