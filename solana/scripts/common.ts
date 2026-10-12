/**
 * Shared helpers for the agent_market tests and seed script.
 * Endpoints come from env (see scripts/local-env.sh and scripts/devnet-env.sh). Keypairs live in git-ignored .keys/.
 */
import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {
  DELEGATION_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID,
  createTopUpEscrowInstruction,
  escrowPdaFromEscrowAuthority,
  magicFeeVaultPdaFromValidator
} from "@magicblock-labs/ephemeral-rollups-sdk";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import idl from "../idl/agent_market.json";
import type { AgentMarket } from "../idl/agent_market";

export const BASE_URL = process.env.PROVIDER_ENDPOINT || "http://127.0.0.1:8899";
export const ER_URL = process.env.EPHEMERAL_PROVIDER_ENDPOINT || "http://127.0.0.1:7799";
export const VALIDATOR = new PublicKey(process.env.VALIDATOR || "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev");
export const NETWORK = process.env.NETWORK_LABEL || "localnet";
export const KEYS_DIR = path.resolve(__dirname, "../.keys");

export const base = new Connection(BASE_URL, { commitment: "confirmed", wsEndpoint: process.env.WS_ENDPOINT || undefined });
export const er = new Connection(ER_URL, { commitment: "confirmed", wsEndpoint: process.env.EPHEMERAL_WS_ENDPOINT || undefined });
export const PROGRAM_ID = new PublicKey((idl as any).address);

export const seeds = {
  config: () => PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0],
  ledger: () => PublicKey.findProgramAddressSync([Buffer.from("ledger")], PROGRAM_ID)[0],
  vault: () => PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID)[0],
  stakeVault: () => PublicKey.findProgramAddressSync([Buffer.from("stake_vault")], PROGRAM_ID)[0],
  agent: (id: number | bigint) => PublicKey.findProgramAddressSync([Buffer.from("agent"), u64(id)], PROGRAM_ID)[0],
  stats: (id: number | bigint) => PublicKey.findProgramAddressSync([Buffer.from("stats"), u64(id)], PROGRAM_ID)[0],
  payout: (id: number | bigint) => PublicKey.findProgramAddressSync([Buffer.from("payout"), u64(id)], PROGRAM_ID)[0],
  tab: (client: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("tab"), client.toBuffer()], PROGRAM_ID)[0],
  receipt: (client: PublicKey, callId: Uint8Array) =>
    PublicKey.findProgramAddressSync([Buffer.from("receipt"), client.toBuffer(), Buffer.from(callId.slice(0, 8))], PROGRAM_ID)[0]
};

export function u64(n: number | bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
}

/** call_id = 8-byte LE Tab nonce ‖ 8 random bytes */
export function makeCallId(nonce: number | bigint): number[] {
  const id = Buffer.concat([u64(nonce), Buffer.from(Keypair.generate().publicKey.toBytes().slice(0, 8))]);
  return Array.from(id);
}

export function loadKeypair(file: string): Keypair {
  const p = file.startsWith("~") ? path.join(os.homedir(), file.slice(1)) : file;
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8"))));
}

/** Load .keys/<name>.json, creating it on first use. Prints only the public key. */
export function keyFile(name: string): Keypair {
  fs.mkdirSync(path.dirname(path.join(KEYS_DIR, name)), { recursive: true });
  const f = path.join(KEYS_DIR, `${name}.json`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(Array.from(Keypair.generate().secretKey)), { mode: 0o600 });
  return loadKeypair(f);
}

export function programFor(conn: Connection, signer: Keypair): Program<AgentMarket> {
  const provider = new anchor.AnchorProvider(conn, new anchor.Wallet(signer), { commitment: "confirmed", skipPreflight: true });
  return new Program<AgentMarket>(idl as any, provider);
}

export async function fundSol(from: Keypair, to: PublicKey, sol: number) {
  const bal = await base.getBalance(to);
  if (bal >= sol * LAMPORTS_PER_SOL * 0.8) return null;
  return sendAndConfirmTransaction(
    base,
    new Transaction().add(SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL - bal) })),
    [from]
  );
}

export async function isDelegated(pk: PublicKey) {
  const info = await base.getAccountInfo(pk);
  return !!info && info.owner.equals(DELEGATION_PROGRAM_ID);
}

/** Wait until the base-layer owner of `pk` matches `owner` (delegation/undelegation propagation) */
export async function waitForOwner(pk: PublicKey, owner: PublicKey, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await base.getAccountInfo(pk);
    if (info?.owner.equals(owner)) return Date.now() - start;
    await sleep(1000);
  }
  throw new Error(`timeout waiting for ${pk.toBase58()} to be owned by ${owner.toBase58()}`);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send one already-built transaction to the ER and measure client-observed latency:
 * from sendRawTransaction until the ER reports it confirmed.
 */
export async function sendErTimed(tx: Transaction, signers: Keypair[]): Promise<{ sig: string; confirmMs: number }> {
  const { blockhash, lastValidBlockHeight } = await er.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = signers[0].publicKey;
  tx.sign(...signers);
  const raw = tx.serialize();
  const t0 = performance.now();
  const sig = await er.sendRawTransaction(raw, { skipPreflight: true });
  const res = await er.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  const confirmMs = Math.round(performance.now() - t0);
  if (res.value.err) {
    const logs = (await er.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }).catch(() => null))?.meta?.logMessages;
    const e: any = new Error(`ER tx ${sig} failed: ${JSON.stringify(res.value.err)}\n${(logs || []).join("\n")}`);
    e.logs = logs;
    throw e;
  }
  return { sig, confirmMs };
}

export async function sendBase(ixs: TransactionInstruction[], signers: Keypair[]) {
  return sendAndConfirmTransaction(base, new Transaction().add(...ixs), signers, { commitment: "confirmed", skipPreflight: true });
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

export interface MarketSetup {
  authority: Keypair;
  mint: PublicKey;
}

/**
 * Initialize Config/Ledger/vaults once (idempotent), with a 6-decimal test mint "tUSDC" whose mint authority is the
 * market authority, then make sure the Ledger is funded, its action escrow topped up, and it is delegated.
 */
export async function ensureMarket(authority: Keypair, opts: { operator?: PublicKey; everyCalls?: number; everySecs?: number; cooldownSecs?: number } = {}): Promise<MarketSetup> {
  const program = programFor(base, authority);
  const configPda = seeds.config();
  let mint: PublicKey;
  const existing = await program.account.config.fetchNullable(configPda);
  if (existing) {
    mint = existing.usdcMint;
  } else {
    mint = await createMint(base, authority, authority.publicKey, null, 6);
    await program.methods
      .initializeConfig(
        opts.operator || authority.publicKey,
        VALIDATOR,
        opts.everyCalls ?? 20,
        opts.everySecs ?? 30,
        new BN(opts.cooldownSecs ?? 60)
      )
      .accountsPartial({ authority: authority.publicKey, usdcMint: mint, tokenProgram: TOKEN_PROGRAM_ID })
      .rpc();
  }

  const ledger = seeds.ledger();
  if (!(await isDelegated(ledger))) {
    const info = await base.getAccountInfo(ledger);
    const want = 0.2 * LAMPORTS_PER_SOL;
    if ((info?.lamports ?? 0) < want) {
      await program.methods.fundLedger(new BN(want - (info?.lamports ?? 0))).accountsPartial({ authority: authority.publicKey }).rpc();
    }
    // Escrow the delegation program uses for the payout actions the Ledger schedules
    const escrow = escrowPdaFromEscrowAuthority(ledger);
    const escrowBal = await base.getBalance(escrow);
    const ixs: TransactionInstruction[] = [];
    if (escrowBal < 0.02 * LAMPORTS_PER_SOL) ixs.push(createTopUpEscrowInstruction(escrow, ledger, authority.publicKey, 0.05 * LAMPORTS_PER_SOL));
    ixs.push(await program.methods.delegateLedger().accountsPartial({ authority: authority.publicKey, validator: VALIDATOR }).instruction());
    await sendBase(ixs, [authority]);
    await waitForOwner(ledger, DELEGATION_PROGRAM_ID);
  }
  return { authority, mint };
}

export async function tokenAccount(payer: Keypair, mint: PublicKey, owner: PublicKey) {
  return (await getOrCreateAssociatedTokenAccount(base, payer, mint, owner)).address;
}

export async function mintTUsdc(authority: Keypair, mint: PublicKey, to: PublicKey, units: number | bigint) {
  return mintTo(base, authority, mint, to, authority, BigInt(units));
}

export const checkpointFixedAccounts = (caller?: PublicKey) => ({
  ledger: seeds.ledger(),
  config: seeds.config(),
  magicFeeVault: magicFeeVaultPdaFromValidator(VALIDATOR),
  programId: PROGRAM_ID,
  caller: caller ?? null,
  magicContext: MAGIC_CONTEXT_ID,
  magicProgram: MAGIC_PROGRAM_ID
});

export { DELEGATION_PROGRAM_ID, MAGIC_CONTEXT_ID, MAGIC_PROGRAM_ID, escrowPdaFromEscrowAuthority, magicFeeVaultPdaFromValidator };
