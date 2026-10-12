import { Router, Request, Response } from "express";
import { BN } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {
  baseExplorerUrl,
  buildPayForCallTx,
  coder,
  erExplorerUrl,
  listSolanaAgents,
  marketProgram,
  mbConnections,
  mbEnv,
  mbPdas,
  num,
  operatorKeypair,
  pick,
  programId,
  readLive,
  resourceHash
} from "../../agents/shared/solanaMarket";
import { erConfirmStats } from "../../agents/shared/mbMetrics";
import { GetCommitmentSignature } from "@magicblock-labs/ephemeral-rollups-sdk";
import { getLastCheckpoint, runCheckpoint } from "./chains/magicblock";

/** MagicBlock-mode HTTP API. Writes that need a user signature return unsigned transactions; the wallet signs. */
export const magicblockRouter = Router();

const pk = (v: unknown) => {
  try {
    return new PublicKey(String(v));
  } catch {
    return null;
  }
};
const fail = (res: Response, status: number, error: string, details?: string) => res.status(status).json({ error, details });
const serialize = (tx: Transaction) => tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");

async function usdcMint(): Promise<PublicKey> {
  if (mbEnv().usdcMint) return new PublicKey(mbEnv().usdcMint);
  const cfg = await readLive(mbPdas.config(), "Config");
  if (!cfg) throw new Error("agent_market Config not found");
  return pick(cfg.data, "usdc_mint");
}

// ---------------------------------------------------------------- metrics (chain-derived except ER latency)

magicblockRouter.get("/api/magicblock/metrics", async (_req, res) => {
  try {
    const { base, er } = mbConnections();
    const [ledger, config, agents] = await Promise.all([
      readLive(mbPdas.ledger(), "Ledger"),
      readLive(mbPdas.config(), "Config"),
      listSolanaAgents()
    ]);
    const payouts = await Promise.all(
      agents.map(async (a) => {
        const info = await base.getAccountInfo(mbPdas.payout(a.id));
        const d: any = info ? coder.accounts.decode("AgentPayout", info.data) : null;
        const sig = (await base.getSignaturesForAddress(mbPdas.payout(a.id), { limit: 1 }).catch(() => []))[0];
        return {
          agentId: a.id,
          skill: a.skill,
          active: a.active,
          payee: a.payee,
          paidTotalUnits: d ? num(pick(d, "paid_total")) : 0,
          payouts: d ? num(d.payouts) : 0,
          lastPayoutSignature: d && num(d.payouts) > 0 ? sig?.signature : undefined,
          lastPayoutExplorerUrl: d && num(d.payouts) > 0 && sig ? baseExplorerUrl(sig.signature) : undefined,
          lastPayoutAt: d && num(d.payouts) > 0 && sig?.blockTime ? new Date(sig.blockTime * 1000).toISOString() : undefined
        };
      })
    );
    // Every checkpoint commits the operator's Tab and no payout touches it, so its latest base signature is the
    // latest commit (or the Tab's own delegate/undelegate) — derived from chain, not from instance memory.
    const op = operatorKeypair();
    const commitSig = op ? (await base.getSignaturesForAddress(mbPdas.tab(op.publicKey), { limit: 1 }).catch(() => []))[0] : undefined;
    const last = getLastCheckpoint();
    if (last && !last.commitSignature) {
      last.commitSignature = await GetCommitmentSignature(last.erSignature, er).catch(() => undefined);
      if (last.commitSignature) last.commitExplorerUrl = baseExplorerUrl(last.commitSignature);
    }
    const l = ledger?.data;
    const totalCalls = num(pick(l, "total_calls"));
    const checkpoints = num(l?.checkpoints);
    const erStats = erConfirmStats();
    let feePerErTxLamports: number | null = null;
    if (erStats.last.length) {
      const tx = await er.getTransaction(erStats.last[erStats.last.length - 1].sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }).catch(() => null);
      feePerErTxLamports = tx?.meta ? tx.meta.fee : null;
    }
    res.json({
      network: "solana-devnet",
      programId: programId().toBase58(),
      erRpc: mbEnv().erRpc,
      validator: mbEnv().validator,
      erConfirm: {
        ...erStats,
        note: "send→confirmed latency measured by this backend instance when it submitted ER payments (last ≤100)"
      },
      feePerErTxLamports,
      ledger: {
        callsSinceCheckpoint: num(pick(l, "calls_since_checkpoint")),
        totalCalls,
        checkpoints,
        lastCheckpointAt: l ? new Date(num(pick(l, "last_checkpoint_ts")) * 1000).toISOString() : null,
        checkpointEveryCalls: num(pick(config?.data, "checkpoint_every_calls")),
        checkpointEverySecs: num(pick(config?.data, "checkpoint_every_secs"))
      },
      callsPerCommit: checkpoints ? Math.round((totalCalls / checkpoints) * 10) / 10 : null,
      totalPaidOutUnits: payouts.reduce((s, p) => s + p.paidTotalUnits, 0),
      payouts,
      lastCommit: commitSig
        ? { signature: commitSig.signature, explorerUrl: baseExplorerUrl(commitSig.signature), at: commitSig.blockTime ? new Date(commitSig.blockTime * 1000).toISOString() : null }
        : null,
      lastCheckpoint: last
    });
  } catch (err: any) {
    fail(res, 502, "Could not read MagicBlock metrics", err.message);
  }
});

// ---------------------------------------------------------------- tabs

magicblockRouter.get("/api/tab/:owner", async (req, res) => {
  const owner = pk(req.params.owner);
  if (!owner) return fail(res, 400, "owner must be a base58 public key");
  try {
    const { base } = mbConnections();
    const mint = await usdcMint();
    const ata = getAssociatedTokenAddressSync(mint, owner);
    const [tab, tokenBal, sol] = await Promise.all([
      readLive(mbPdas.tab(owner), "Tab"),
      base.getTokenAccountBalance(ata).catch(() => null),
      base.getBalance(owner)
    ]);
    const t = tab?.data;
    res.json({
      owner: owner.toBase58(),
      tab: t
        ? {
            address: mbPdas.tab(owner).toBase58(),
            delegated: tab!.delegated,
            depositedUnits: num(t.deposited),
            spentUnits: num(t.spent),
            availableUnits: num(t.deposited) - num(t.spent),
            nextNonce: num(pick(t, "next_nonce")),
            openReceipts: num(pick(t, "open_receipts"))
          }
        : null,
      tUsdcUnits: tokenBal ? Number(tokenBal.value.amount) : 0,
      tokenAccount: ata.toBase58(),
      solLamports: sol,
      mint: mint.toBase58()
    });
  } catch (err: any) {
    fail(res, 502, "Could not read tab", err.message);
  }
});

/** Unsigned base-layer tx: deposit tUSDC into the vault, fund ER receipt rent, delegate the Tab to the pinned ER */
magicblockRouter.post("/api/tab/open", async (req, res) => {
  const owner = pk(req.body?.owner);
  const amount = Number(req.body?.amountUnits ?? 50_000);
  if (!owner || !Number.isInteger(amount) || amount <= 0 || amount > 10_000_000) return fail(res, 400, "owner and amountUnits (1..10_000_000) required");
  try {
    const { base } = mbConnections();
    const existing = await readLive(mbPdas.tab(owner), "Tab");
    if (existing?.delegated) return fail(res, 409, "Tab is already open on the ER — close it before depositing again");
    const mint = await usdcMint();
    const p = marketProgram(base);
    const open = await p.methods
      .openTab(new BN(amount), new BN(0.01 * LAMPORTS_PER_SOL))
      .accountsPartial({ client: owner, clientToken: getAssociatedTokenAddressSync(mint, owner), tokenProgram: TOKEN_PROGRAM_ID })
      .instruction();
    const delegate = await p.methods.delegateTab().accountsPartial({ client: owner, validator: new PublicKey(mbEnv().validator) }).instruction();
    const { blockhash, lastValidBlockHeight } = await base.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(open, delegate);
    res.json({ layer: "base", tx: serialize(tx), steps: ["open_tab", "delegate_tab"] });
  } catch (err: any) {
    fail(res, 502, "Could not build open-tab transaction", err.message);
  }
});

/** step=undelegate → unsigned ER tx (commit + undelegate the Tab); step=withdraw → unsigned base tx (refund + close) */
magicblockRouter.post("/api/tab/close", async (req, res) => {
  const owner = pk(req.body?.owner);
  const step = req.body?.step;
  if (!owner || !["undelegate", "withdraw"].includes(step)) return fail(res, 400, "owner and step (undelegate|withdraw) required");
  try {
    const { base, er } = mbConnections();
    if (step === "undelegate") {
      const ix = await marketProgram(er).methods.undelegateTab().accountsPartial({ client: owner }).instruction();
      const { blockhash, lastValidBlockHeight } = await er.getLatestBlockhash("confirmed");
      return res.json({ layer: "er", tx: serialize(new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(ix)) });
    }
    const mint = await usdcMint();
    const ix = await marketProgram(base)
      .methods.closeTab()
      .accountsPartial({ client: owner, clientToken: getAssociatedTokenAddressSync(mint, owner), tokenProgram: TOKEN_PROGRAM_ID })
      .instruction();
    const { blockhash, lastValidBlockHeight } = await base.getLatestBlockhash("confirmed");
    res.json({ layer: "base", tx: serialize(new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }).add(ix)) });
  } catch (err: any) {
    fail(res, 502, "Could not build close-tab transaction", err.message);
  }
});

// ---------------------------------------------------------------- Mode B transaction builders

/** Unsigned pay_for_call for the browser wallet; resource_hash binds it to exactly this request */
magicblockRouter.post("/api/magicblock/pay-tx", async (req, res) => {
  const client = pk(req.body?.client);
  const agentId = Number(req.body?.agentId);
  const { method = "POST", path, body } = req.body || {};
  if (!client || !Number.isInteger(agentId) || typeof path !== "string") return fail(res, 400, "client, agentId and path required");
  try {
    const agent = (await listSolanaAgents()).find((a) => a.id === agentId && a.active);
    if (!agent) return fail(res, 404, `No active agent #${agentId}`);
    const { tx, callId, receiptPda } = await buildPayForCallTx(client, agentId, agent.priceUnits, resourceHash(method, path, body));
    res.json({ layer: "er", tx: serialize(tx), callId: Buffer.from(callId).toString("hex"), receiptPda: receiptPda.toBase58(), amountUnits: agent.priceUnits.toString(), payTo: agent.payee });
  } catch (err: any) {
    fail(res, 502, "Could not build pay_for_call", err.message);
  }
});

/** Unsigned submit_feedback for the paying wallet — stored as an independent (Client) review */
magicblockRouter.post("/api/magicblock/feedback-tx", async (req, res) => {
  const reviewer = pk(req.body?.reviewer);
  const agentId = Number(req.body?.agentId);
  const score = Number(req.body?.score);
  const callId = String(req.body?.callId || "");
  if (!reviewer || !Number.isInteger(agentId) || !/^[0-9a-f]{32}$/i.test(callId) || !(score >= 0 && score <= 100)) {
    return fail(res, 400, "reviewer, agentId, callId (32 hex chars) and score (0-100) required");
  }
  try {
    const { er } = mbConnections();
    const id = Array.from(Buffer.from(callId, "hex"));
    const ix = await marketProgram(er)
      .methods.submitFeedback(new BN(agentId), id, Math.round(score))
      .accountsPartial({
        reviewer,
        tab: mbPdas.tab(reviewer),
        agentProfile: mbPdas.agent(agentId),
        agentStats: mbPdas.stats(agentId),
        receipt: mbPdas.receipt(reviewer, Uint8Array.from(id))
      })
      .instruction();
    const { blockhash, lastValidBlockHeight } = await er.getLatestBlockhash("confirmed");
    res.json({ layer: "er", tx: serialize(new Transaction({ feePayer: reviewer, blockhash, lastValidBlockHeight }).add(ix)) });
  } catch (err: any) {
    fail(res, 502, "Could not build submit_feedback", err.message);
  }
});

/** Broadcast a wallet-signed transaction to base or the ER. Only agent_market (+ compute budget) instructions. */
magicblockRouter.post("/api/magicblock/relay", async (req, res) => {
  const layer = req.body?.layer === "er" ? "er" : "base";
  let tx: Transaction;
  try {
    tx = Transaction.from(Buffer.from(String(req.body?.tx || ""), "base64"));
  } catch {
    return fail(res, 400, "tx must be a base64 serialized signed transaction");
  }
  const allowed = [programId().toBase58(), ComputeBudgetProgram.programId.toBase58()];
  if (!tx.instructions.length || tx.instructions.some((ix) => !allowed.includes(ix.programId.toBase58()))) {
    return fail(res, 400, "Only agent_market instructions can be relayed");
  }
  if (!tx.verifySignatures()) return fail(res, 400, "Transaction is not fully signed");
  try {
    const conn = layer === "er" ? mbConnections().er : mbConnections().base;
    const t0 = performance.now();
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: layer === "er" });
    const conf = await conn.confirmTransaction(sig, "confirmed");
    const confirmMs = Math.round(performance.now() - t0);
    if (conf.value.err) {
      const logs = (await conn.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }).catch(() => null))?.meta?.logMessages || [];
      return fail(res, 400, "Transaction failed", logs.find((l) => /Error Message|AnchorError|insufficient/i.test(l)) || JSON.stringify(conf.value.err));
    }
    res.json({ signature: sig, layer, confirmMs, explorerUrl: layer === "er" ? erExplorerUrl(sig) : baseExplorerUrl(sig) });
  } catch (err: any) {
    fail(res, 502, "Broadcast failed", err.message);
  }
});

// ---------------------------------------------------------------- tUSDC faucet (test mint, operator is mint authority)

const faucetLog = new Map<string, number>();
magicblockRouter.post("/api/magicblock/faucet", async (req, res) => {
  const owner = pk(req.body?.owner);
  if (!owner) return fail(res, 400, "owner required");
  const last = faucetLog.get(owner.toBase58());
  if (last && Date.now() - last < 6 * 3600_000) return fail(res, 429, "This wallet already received test funds in the last 6 hours");
  const op = operatorKeypair();
  if (!op) return fail(res, 503, "Faucet unavailable: operator key not configured");
  try {
    const { base } = mbConnections();
    const mint = await usdcMint();
    const ata = getAssociatedTokenAddressSync(mint, owner);
    const units = 50_000; // 0.05 tUSDC = 50 calls
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(op.publicKey, ata, owner, mint),
      createMintToInstruction(mint, ata, op.publicKey, units)
    );
    const sol = await base.getBalance(owner);
    const solGift = sol < 0.02 * LAMPORTS_PER_SOL ? Math.round(0.03 * LAMPORTS_PER_SOL) : 0;
    if (solGift) tx.add(SystemProgram.transfer({ fromPubkey: op.publicKey, toPubkey: owner, lamports: solGift }));
    const sig = await base.sendTransaction(tx, [op]);
    await base.confirmTransaction(sig, "confirmed");
    faucetLog.set(owner.toBase58(), Date.now());
    res.json({ signature: sig, explorerUrl: baseExplorerUrl(sig), tUsdcUnits: units, solLamports: solGift, tokenAccount: ata.toBase58() });
  } catch (err: any) {
    fail(res, 502, "Faucet failed", err.message);
  }
});

// ---------------------------------------------------------------- checkpoint

/** With the admin token: force a checkpoint. Without: the program's own rate limit decides whether it runs. */
magicblockRouter.post("/api/checkpoint", async (req: Request, res: Response) => {
  const token = process.env.CHECKPOINT_ADMIN_TOKEN;
  const force = !!token && req.headers["x-admin-token"] === token;
  try {
    res.json(await runCheckpoint(force));
  } catch (err: any) {
    fail(res, 502, "Checkpoint failed", err.message);
  }
});
