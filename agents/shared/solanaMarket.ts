/**
 * MagicBlock mode: read/write the agent_market program on Solana devnet and its Ephemeral Rollup.
 * Shared by the agents' ER x402 middleware and the orchestrator's magicblock chain adapter.
 *
 * Env: SOLANA_RPC_URL, MAGIC_ROUTER_URL, ER_RPC_URL, ER_VALIDATOR, AGENT_MARKET_PROGRAM_ID, USDC_MINT,
 *      SOLANA_OPERATOR_SECRET_KEY (JSON byte array) — see .env.example.
 */
import { createHash } from "crypto";
import * as anchor from "@coral-xyz/anchor";
import { BN, BorshCoder, Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { ConnectionMagicRouter, DELEGATION_PROGRAM_ID } from "@magicblock-labs/ephemeral-rollups-sdk";
import idl from "../../solana/idl/agent_market.json";

export const mbEnv = () => ({
  solanaRpc: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  routerUrl: process.env.MAGIC_ROUTER_URL || "https://devnet-router.magicblock.app",
  erRpc: process.env.ER_RPC_URL || "https://devnet-us.magicblock.app",
  validator: process.env.ER_VALIDATOR || "MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd",
  programId: process.env.AGENT_MARKET_PROGRAM_ID || (idl as any).address,
  usdcMint: process.env.USDC_MINT || ""
});

let conns: { base: Connection; er: Connection; router: ConnectionMagicRouter } | null = null;
export function mbConnections() {
  if (!conns) {
    const e = mbEnv();
    conns = {
      base: new Connection(e.solanaRpc, "confirmed"),
      er: new Connection(e.erRpc, "confirmed"),
      router: new ConnectionMagicRouter(e.routerUrl, { commitment: "confirmed" } as any)
    };
  }
  return conns;
}

export const programId = () => new PublicKey(mbEnv().programId);
export const coder = new BorshCoder(idl as any);

const pda = (...seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, programId())[0];
export const u64 = (n: number | bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};
export const mbPdas = {
  config: () => pda(Buffer.from("config")),
  ledger: () => pda(Buffer.from("ledger")),
  vault: () => pda(Buffer.from("vault")),
  agent: (id: number) => pda(Buffer.from("agent"), u64(id)),
  stats: (id: number) => pda(Buffer.from("stats"), u64(id)),
  payout: (id: number) => pda(Buffer.from("payout"), u64(id)),
  tab: (client: PublicKey) => pda(Buffer.from("tab"), client.toBuffer()),
  receipt: (client: PublicKey, callId: Uint8Array) => pda(Buffer.from("receipt"), client.toBuffer(), Buffer.from(callId.slice(0, 8)))
};

/** Program bound to a connection, for building instructions (the wallet only matters for .rpc(), which we don't use) */
export function marketProgram(conn: Connection, signer?: Keypair): Program<any> {
  const wallet = new anchor.Wallet(signer || Keypair.generate());
  return new Program(idl as any, new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" }));
}

export function operatorKeypair(): Keypair | null {
  const raw = process.env.SOLANA_OPERATOR_SECRET_KEY;
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  } catch {
    return null;
  }
}

export interface SolanaAgent {
  id: number;
  owner: string;
  payee: string;
  name: string;
  skill: string;
  endpoint: string;
  priceUnits: bigint;
  active: boolean;
  stake: bigint;
  metadataUri: string;
}

/** Field from a decoded account, whether the coder returned snake_case or camelCase names */
export function pick(o: any, snake: string): any {
  if (o == null) return undefined;
  if (snake in o) return o[snake];
  return o[snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
}
export const num = (v: any) => (v == null ? 0 : Number(v.toString()));

const discriminator = (name: string) => Buffer.from(((idl as any).accounts as any[]).find((a) => a.name === name).discriminator);

let agentCache: { at: number; agents: Promise<SolanaAgent[]> } | null = null;
/** Every AgentProfile on the base layer (AgentProfile is never delegated), cached 60s */
export function listSolanaAgents(force = false): Promise<SolanaAgent[]> {
  if (force || !agentCache || Date.now() - agentCache.at > 60_000) {
    const { base } = mbConnections();
    const agents = base
      .getProgramAccounts(programId(), { filters: [{ memcmp: { offset: 0, bytes: anchor.utils.bytes.bs58.encode(discriminator("AgentProfile")) } }] })
      .then((rows) =>
        rows
          .map(({ account }) => {
            const a: any = coder.accounts.decode("AgentProfile", account.data);
            return {
              id: num(pick(a, "agent_id")),
              owner: a.owner.toBase58(),
              payee: a.payee.toBase58(),
              name: a.name,
              skill: a.skill,
              endpoint: a.endpoint,
              priceUnits: BigInt(pick(a, "price_units").toString()),
              active: a.active,
              stake: BigInt(a.stake.toString()),
              metadataUri: pick(a, "metadata_uri")
            };
          })
          .sort((x, y) => x.id - y.id)
      );
    agentCache = { at: Date.now(), agents };
    agents.catch(() => {
      if (agentCache?.agents === agents) agentCache = null;
    });
  }
  return agentCache.agents;
}

export async function solanaAgentForSkill(skill: string): Promise<SolanaAgent | undefined> {
  return (await listSolanaAgents()).filter((a) => a.active && a.skill === skill).sort((x, y) => x.id - y.id)[0];
}

/** Read an account where it currently lives: the ER while delegated, base otherwise */
export async function readLive(pk: PublicKey, accountName: string): Promise<{ data: any; delegated: boolean } | null> {
  const { base, er } = mbConnections();
  const info = await base.getAccountInfo(pk);
  if (!info) return null;
  const delegated = info.owner.equals(DELEGATION_PROGRAM_ID);
  const src = delegated ? await er.getAccountInfo(pk) : info;
  if (!src) return null;
  return { data: coder.accounts.decode(accountName, src.data), delegated };
}

/** sha256(method + path + body) — binds a payment to the exact request it pays for */
export function resourceHash(method: string, path: string, body: unknown): Buffer {
  return createHash("sha256").update(method.toUpperCase() + path + JSON.stringify(body ?? {})).digest();
}

/** call_id = Tab nonce (u64 LE) ‖ 8 random bytes */
export function makeCallId(nonce: bigint | number): number[] {
  return Array.from(Buffer.concat([u64(nonce), Keypair.generate().publicKey.toBuffer().subarray(0, 8)]));
}

/** Unsigned pay_for_call transaction with a fresh ER blockhash */
export async function buildPayForCallTx(client: PublicKey, agentId: number, amount: bigint, resource: Buffer) {
  const { er } = mbConnections();
  const tab = await readLive(mbPdas.tab(client), "Tab");
  if (!tab?.delegated) throw new Error(`No delegated Tab for ${client.toBase58()} — open one first`);
  const callId = makeCallId(BigInt(pick(tab.data, "next_nonce").toString()));
  const ix = await marketProgram(er)
    .methods.payForCall(new BN(agentId), new BN(amount.toString()), callId, Array.from(resource))
    .accountsPartial({ client, agentProfile: mbPdas.agent(agentId), agentStats: mbPdas.stats(agentId) })
    .instruction();
  const { blockhash, lastValidBlockHeight } = await er.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: client, blockhash, lastValidBlockHeight }).add(ix);
  return { tx, callId, receiptPda: mbPdas.receipt(client, Uint8Array.from(callId)) };
}

export const erExplorerUrl = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(mbEnv().erRpc)}`;
export const baseExplorerUrl = (sigOrAddr: string, kind: "tx" | "address" = "tx") => `https://explorer.solana.com/${kind}/${sigOrAddr}?cluster=devnet`;
