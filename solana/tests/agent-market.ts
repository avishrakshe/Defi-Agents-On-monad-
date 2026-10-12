/**
 * Full lifecycle on a MagicBlock ER (local stack or devnet, chosen by env):
 * register → stake → open_tab → delegate → 50× pay_for_call on the ER (median confirm ms) → feedback (client + operator)
 * → checkpoint (commit + payout Magic Action) → payout observed on base → undelegate → close_tab.
 * Plus the negative paths: replay, insufficient tab, underpayment, feedback without receipt, double feedback,
 * non-owner update_agent and a direct (unauthorized) call to the payout action.
 */
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { GetCommitmentSignature } from "@magicblock-labs/ephemeral-rollups-sdk";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  base,
  er,
  BASE_URL,
  ER_URL,
  NETWORK,
  VALIDATOR,
  DELEGATION_PROGRAM_ID,
  PROGRAM_ID,
  checkpointFixedAccounts,
  ensureMarket,
  escrowPdaFromEscrowAuthority,
  fundSol,
  isDelegated,
  keyFile,
  loadKeypair,
  makeCallId,
  median,
  mintTUsdc,
  programFor,
  seeds,
  sendErTimed,
  sleep,
  tokenAccount,
  waitForOwner
} from "../scripts/common";

const AUTHORITY = loadKeypair(process.env.AUTHORITY_KEYPAIR || "~/.config/solana/id.json");
const RESULTS = path.resolve(__dirname, `../test-results-${NETWORK}.json`);
const PRICE = 1000; // $0.001 tUSDC
const N_CALLS = Number(process.env.N_CALLS || 50);

async function expectErFailure(p: Promise<any>, pattern: RegExp) {
  try {
    await p;
  } catch (e: any) {
    const text = `${e.message}\n${(e.logs || []).join("\n")}`;
    expect(text, text).to.match(pattern);
    return text.match(pattern)![0];
  }
  throw new Error(`expected failure matching ${pattern}`);
}

describe(`agent_market on ${NETWORK}`, () => {
  const results: any = { network: NETWORK, base: BASE_URL, er: ER_URL, validator: VALIDATOR.toBase58(), program: PROGRAM_ID.toBase58(), negative: {} };
  const owner = keyFile(`test/${NETWORK}-owner`);
  const stranger = keyFile(`test/${NETWORK}-stranger`);
  const client = Keypair.generate();
  let mint: PublicKey;
  let agentId: number;
  let payee: PublicKey;
  let clientToken: PublicKey;
  const callIds: number[][] = [];

  const p = () => programFor(base, AUTHORITY);
  const erProgram = (kp: Keypair) => programFor(er, kp);

  const payForCallTx = async (signer: Keypair, id: number, amount: number, callId: number[]) =>
    new Transaction().add(
      await erProgram(signer)
        .methods.payForCall(new BN(id), new BN(amount), callId, Array.from(Buffer.alloc(32, 7)))
        .accountsPartial({ client: signer.publicKey, agentProfile: seeds.agent(id), agentStats: seeds.stats(id) })
        .instruction()
    );

  const nextNonce = async (who: PublicKey) => (await erProgram(AUTHORITY).account.tab.fetch(seeds.tab(who))).nextNonce.toNumber();

  after(() => {
    fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2));
    console.log(`\nresults → ${RESULTS}`);
  });

  it("initializes the market (config, vaults, delegated Ledger)", async () => {
    await fundSol(AUTHORITY, owner.publicKey, 0.3);
    await fundSol(AUTHORITY, stranger.publicKey, 0.05);
    await fundSol(AUTHORITY, client.publicKey, 0.3);
    ({ mint } = await ensureMarket(AUTHORITY, { everyCalls: 1000, everySecs: 3600 }));
    expect(await isDelegated(seeds.ledger())).to.eq(true);
    results.mint = mint.toBase58();
  });

  it("registers an agent (owner signs, payee = owner's tUSDC account) and stakes", async () => {
    const config = await p().account.config.fetch(seeds.config());
    agentId = config.agentCount.toNumber() + 1;
    payee = await tokenAccount(AUTHORITY, mint, owner.publicKey);
    await programFor(base, owner)
      .methods.registerAgent(new BN(agentId), `test agent ${agentId}`, "test-skill", "https://example.invalid/api", new BN(PRICE), "{}")
      .accountsPartial({ owner: owner.publicKey, payee })
      .rpc();
    await mintTUsdc(AUTHORITY, mint, payee, 2_000_000);
    await programFor(base, owner)
      .methods.stake(new BN(1_000_000))
      .accountsPartial({ owner: owner.publicKey, agentProfile: seeds.agent(agentId), ownerToken: payee, tokenProgram: TOKEN_PROGRAM_ID })
      .rpc();
    const prof = await p().account.agentProfile.fetch(seeds.agent(agentId));
    expect(prof.owner.toBase58()).to.eq(owner.publicKey.toBase58());
    expect(prof.payee.toBase58()).to.eq(payee.toBase58());
    expect(prof.stake.toNumber()).to.eq(1_000_000);
    results.agentId = agentId;
  });

  it("rejects update_agent from a non-owner", async () => {
    const ix = await programFor(base, stranger)
      .methods.updateAgent("https://evil.invalid", new BN(0), "")
      .accountsPartial({ owner: stranger.publicKey, agentProfile: seeds.agent(agentId) })
      .instruction();
    const msg = new TransactionMessage({ payerKey: stranger.publicKey, recentBlockhash: (await base.getLatestBlockhash()).blockhash, instructions: [ix] }).compileToV0Message();
    const vtx = new VersionedTransaction(msg);
    vtx.sign([stranger]);
    const sim = await base.simulateTransaction(vtx);
    const logs = (sim.value.logs || []).join("\n");
    expect(sim.value.err, logs).to.not.eq(null);
    expect(logs).to.match(/Unauthorized|ConstraintHasOne/);
    results.negative.nonOwnerUpdate = (logs.match(/Error Code: \w+/) || [logs.slice(-200)])[0];
    expect((await p().account.agentProfile.fetch(seeds.agent(agentId))).endpoint).to.eq("https://example.invalid/api");
  });

  it("opens and delegates the client's Tab; delegates AgentStats", async () => {
    clientToken = await tokenAccount(AUTHORITY, mint, client.publicKey);
    await mintTUsdc(AUTHORITY, mint, clientToken, 200_000);
    await programFor(base, client)
      .methods.openTab(new BN(100_000), new BN(0.02 * LAMPORTS_PER_SOL))
      .accountsPartial({ client: client.publicKey, clientToken, tokenProgram: TOKEN_PROGRAM_ID })
      .rpc();
    await programFor(base, client).methods.delegateTab().accountsPartial({ client: client.publicKey, validator: VALIDATOR }).rpc();
    await p().methods.delegateAgentStats(new BN(agentId)).accountsPartial({ authority: AUTHORITY.publicKey, validator: VALIDATOR }).rpc();
    await waitForOwner(seeds.tab(client.publicKey), DELEGATION_PROGRAM_ID);
    await waitForOwner(seeds.stats(agentId), DELEGATION_PROGRAM_ID);
    // let the ER clone the delegated accounts
    for (let i = 0; i < 30; i++) {
      if (await er.getAccountInfo(seeds.tab(client.publicKey))) break;
      await sleep(1000);
    }
  });

  it(`pays for ${N_CALLS} calls on the ER (one tx each: debit Tab, credit agent, create ephemeral receipt)`, async () => {
    let nonce = await nextNonce(client.publicKey);
    const ms: number[] = [];
    const sigs: string[] = [];
    for (let i = 0; i < N_CALLS; i++) {
      const callId = makeCallId(nonce++);
      const { sig, confirmMs } = await sendErTimed(await payForCallTx(client, agentId, PRICE, callId), [client]);
      ms.push(confirmMs);
      sigs.push(sig);
      callIds.push(callId);
    }
    const stats = await erProgram(AUTHORITY).account.agentStats.fetch(seeds.stats(agentId));
    expect(stats.paidCalls.toNumber()).to.eq(N_CALLS);
    expect(stats.earnedTotal.toNumber()).to.eq(N_CALLS * PRICE);
    const receipt = await er.getAccountInfo(seeds.receipt(client.publicKey, Uint8Array.from(callIds[0])));
    expect(receipt, "receipt exists on the ER").to.not.eq(null);
    expect(await base.getAccountInfo(seeds.receipt(client.publicKey, Uint8Array.from(callIds[0]))), "receipt never on base").to.eq(null);
    results.payForCall = { n: N_CALLS, medianConfirmMs: median(ms), minMs: Math.min(...ms), maxMs: Math.max(...ms), samplesMs: ms, firstSig: sigs[0], lastSig: sigs[sigs.length - 1] };
    console.log(`    median ER confirm ${median(ms)} ms over ${N_CALLS} calls (min ${Math.min(...ms)}, max ${Math.max(...ms)})`);
  });

  it("rejects a replayed call_id", async () => {
    results.negative.replay = await expectErFailure(sendErTimed(await payForCallTx(client, agentId, PRICE, callIds[0]), [client]), /StaleCallId|0x17|already in use|custom program error/);
  });

  it("rejects underpayment", async () => {
    results.negative.underpay = await expectErFailure(
      sendErTimed(await payForCallTx(client, agentId, PRICE - 1, makeCallId(await nextNonce(client.publicKey))), [client]),
      /Underpaid|custom program error/
    );
  });

  it("rejects a call larger than the Tab balance", async () => {
    results.negative.insufficientTab = await expectErFailure(
      sendErTimed(await payForCallTx(client, agentId, 10_000_000, makeCallId(await nextNonce(client.publicKey))), [client]),
      /InsufficientTab|custom program error/
    );
  });

  const feedbackTx = async (signer: Keypair, tabOwner: PublicKey, callId: number[], score: number) =>
    new Transaction().add(
      await erProgram(signer)
        .methods.submitFeedback(new BN(agentId), callId, score)
        .accountsPartial({
          reviewer: signer.publicKey,
          tab: seeds.tab(tabOwner),
          agentProfile: seeds.agent(agentId),
          agentStats: seeds.stats(agentId),
          receipt: seeds.receipt(tabOwner, Uint8Array.from(callId))
        })
        .instruction()
    );

  it("records an independent (client) review and closes the receipt", async () => {
    const { sig } = await sendErTimed(await feedbackTx(client, client.publicKey, callIds[0], 80), [client]);
    const stats = await erProgram(AUTHORITY).account.agentStats.fetch(seeds.stats(agentId));
    expect(stats.clientReviews.toNumber()).to.eq(1);
    expect(stats.clientScoreSum.toNumber()).to.eq(80);
    const closed = await er.getAccountInfo(seeds.receipt(client.publicKey, Uint8Array.from(callIds[0])));
    expect(!closed || closed.data.length === 0, "receipt closed").to.eq(true);
    results.clientFeedbackSig = sig;
  });

  it("rejects a second review of the same call", async () => {
    results.negative.doubleFeedback = await expectErFailure(sendErTimed(await feedbackTx(client, client.publicKey, callIds[0], 10), [client]), /NoReceipt|AlreadyReviewed|custom program error|AccountNotInitialized|not found/i);
  });

  it("rejects feedback without a receipt", async () => {
    results.negative.noReceipt = await expectErFailure(
      sendErTimed(await feedbackTx(client, client.publicKey, makeCallId(999_999), 50), [client]),
      /NoReceipt|custom program error|AccountNotInitialized|not found/i
    );
  });

  it("rejects the operator reviewing a call a client paid for", async () => {
    results.negative.operatorOnClientCall = await expectErFailure(sendErTimed(await feedbackTx(AUTHORITY, client.publicKey, callIds[1], 100), [AUTHORITY]), /NotOperatorCall|custom program error/);
  });

  it("records an operator review for a call the operator paid for", async () => {
    // Operator (= authority here) pays from its own Tab
    const opToken = await tokenAccount(AUTHORITY, mint, AUTHORITY.publicKey);
    if (!(await isDelegated(seeds.tab(AUTHORITY.publicKey)))) {
      await mintTUsdc(AUTHORITY, mint, opToken, 100_000);
      await p().methods.openTab(new BN(100_000), new BN(0.02 * LAMPORTS_PER_SOL)).accountsPartial({ client: AUTHORITY.publicKey, clientToken: opToken, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
      await p().methods.delegateTab().accountsPartial({ client: AUTHORITY.publicKey, validator: VALIDATOR }).rpc();
      await waitForOwner(seeds.tab(AUTHORITY.publicKey), DELEGATION_PROGRAM_ID);
      for (let i = 0; i < 30 && !(await er.getAccountInfo(seeds.tab(AUTHORITY.publicKey))); i++) await sleep(1000);
    }
    const callId = makeCallId(await nextNonce(AUTHORITY.publicKey));
    await sendErTimed(await payForCallTx(AUTHORITY, agentId, PRICE, callId), [AUTHORITY]);
    const { sig } = await sendErTimed(await feedbackTx(AUTHORITY, AUTHORITY.publicKey, callId, 95), [AUTHORITY]);
    const stats = await erProgram(AUTHORITY).account.agentStats.fetch(seeds.stats(agentId));
    expect(stats.operatorReviews.toNumber()).to.eq(1);
    expect(stats.clientReviews.toNumber()).to.eq(1);
    results.operatorFeedbackSig = sig;
  });

  it("rejects a direct call to the payout action (escrow cannot sign)", async () => {
    const ledger = seeds.ledger();
    results.negative.directPayout = await expectErFailure(
      programFor(base, stranger)
        .methods.payout()
        .accountsPartial({
          agentProfile: seeds.agent(agentId),
          agentStats: seeds.stats(agentId),
          agentPayout: seeds.payout(agentId),
          payee,
          tokenProgram: TOKEN_PROGRAM_ID,
          sourceProgram: PROGRAM_ID,
          escrowAuth: ledger,
          escrow: escrowPdaFromEscrowAuthority(ledger)
        })
        .rpc(),
      /Signature verification failed|Missing signature|unknown signer|signer/i
    );
  });

  it("checkpoint: commits AgentStats + Tab and pays the agent's payee on base via a Magic Action", async () => {
    const before = Number((await getAccount(base, payee)).amount);
    const earned = (await erProgram(AUTHORITY).account.agentStats.fetch(seeds.stats(agentId))).earnedTotal.toNumber();
    const paidBefore = (await p().account.agentPayout.fetch(seeds.payout(agentId))).paidTotal.toNumber();
    const ix = await erProgram(AUTHORITY)
      .methods.checkpoint(1)
      .accountsPartial(checkpointFixedAccounts(AUTHORITY.publicKey))
      .remainingAccounts([
        { pubkey: seeds.stats(agentId), isSigner: false, isWritable: true },
        { pubkey: seeds.agent(agentId), isSigner: false, isWritable: false },
        { pubkey: seeds.tab(client.publicKey), isSigner: false, isWritable: true }
      ])
      .instruction();
    const { sig } = await sendErTimed(new Transaction().add(ix), [AUTHORITY]);
    const commitSig = await GetCommitmentSignature(sig, er);
    results.checkpoint = { erSig: sig, commitSig };
    let after = before;
    const t0 = Date.now();
    while (Date.now() - t0 < 90_000) {
      after = Number((await getAccount(base, payee)).amount);
      if (after - before >= earned - paidBefore) break;
      await sleep(2000);
    }
    const payout = await p().account.agentPayout.fetch(seeds.payout(agentId));
    results.checkpoint.payoutObservedMs = Date.now() - t0;
    results.checkpoint.paidToPayee = after - before;
    console.log(`    commit ${commitSig}, payee +${after - before} units`);
    expect(after - before).to.eq(earned - paidBefore);
    expect(payout.paidTotal.toNumber()).to.eq(earned);
    // the payout tx is the one that touched AgentPayout most recently
    const sigs = await base.getSignaturesForAddress(seeds.payout(agentId), { limit: 1 });
    results.checkpoint.payoutSig = sigs[0]?.signature;
  });

  it("undelegates the Tab and closes it, refunding the unspent balance", async () => {
    const tabBefore = await erProgram(AUTHORITY).account.tab.fetch(seeds.tab(client.publicKey));
    const ix = await erProgram(client).methods.undelegateTab().accountsPartial({ client: client.publicKey }).instruction();
    const { sig } = await sendErTimed(new Transaction().add(ix), [client]);
    await waitForOwner(seeds.tab(client.publicKey), PROGRAM_ID, 90_000);
    const before = Number((await getAccount(base, clientToken)).amount);
    await programFor(base, client).methods.closeTab().accountsPartial({ client: client.publicKey, clientToken, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
    const after = Number((await getAccount(base, clientToken)).amount);
    expect(after - before).to.eq(tabBefore.deposited.toNumber() - tabBefore.spent.toNumber());
    results.closeTab = { undelegateSig: sig, refund: after - before };
  });

  it("deactivates the test agent so it never shows up as a live listing", async () => {
    await programFor(base, owner).methods.setActive(false).accountsPartial({ signer: owner.publicKey, agentProfile: seeds.agent(agentId) }).rpc();
  });
});
