use anchor_lang::prelude::*;

pub const CONFIG_SEED: &[u8] = b"config";
pub const LEDGER_SEED: &[u8] = b"ledger";
pub const AGENT_SEED: &[u8] = b"agent";
pub const STATS_SEED: &[u8] = b"stats";
pub const PAYOUT_SEED: &[u8] = b"payout";
pub const TAB_SEED: &[u8] = b"tab";
pub const RECEIPT_SEED: &[u8] = b"receipt";
pub const VAULT_SEED: &[u8] = b"vault";
pub const STAKE_VAULT_SEED: &[u8] = b"stake_vault";

/// Escrow index used by `ActionArgs::new` when scheduling post-commit actions.
pub const ACTION_ESCROW_INDEX: u8 = 255;
pub const MAX_SCORE: u8 = 100;

/// Base layer. Global settings and the vault authority.
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    /// Mode A operator: its reviews of calls it paid for are stored as Operator, never Client
    pub operator: Pubkey,
    pub usdc_mint: Pubkey,
    /// Pinned ER validator — every delegation goes here so related accounts share one ER
    pub validator: Pubkey,
    pub agent_count: u64,
    pub checkpoint_every_calls: u32,
    pub checkpoint_every_secs: u32,
    pub unstake_cooldown_secs: i64,
    pub bump: u8,
    pub vault_bump: u8,
    pub stake_vault_bump: u8,
}

/// Delegated. The program's delegated fee payer for commits (magic_fee_vault path), the escrow authority
/// for payout Magic Actions, and the counters that rate-limit permissionless checkpoints.
#[account]
#[derive(InitSpace)]
pub struct Ledger {
    pub calls_since_checkpoint: u64,
    pub total_calls: u64,
    pub last_checkpoint_ts: i64,
    pub checkpoints: u64,
    pub bump: u8,
}

/// Base layer. ERC-8004-style identity with its own owner and payee.
#[account]
#[derive(InitSpace)]
pub struct AgentProfile {
    pub agent_id: u64,
    pub owner: Pubkey,
    /// USDC token account owned by `owner` (checked when set)
    pub payee: Pubkey,
    pub price_units: u64,
    pub active: bool,
    pub registered_at: i64,
    pub stake: u64,
    pub unstake_pending: u64,
    pub unstake_requested_at: i64,
    pub slashed_total: u64,
    pub bump: u8,
    #[max_len(48)]
    pub name: String,
    #[max_len(32)]
    pub skill: String,
    #[max_len(160)]
    pub endpoint: String,
    #[max_len(200)]
    pub metadata_uri: String,
}

/// Delegated. Per-agent earnings and split reputation, updated on the ER every call.
#[account]
#[derive(InitSpace)]
pub struct AgentStats {
    pub agent_id: u64,
    /// Monotonic. Payout pays `earned_total - AgentPayout.paid_total`, so payouts are idempotent.
    pub earned_total: u64,
    pub paid_calls: u64,
    pub client_score_sum: u64,
    pub client_reviews: u64,
    pub operator_score_sum: u64,
    pub operator_reviews: u64,
    pub bump: u8,
}

/// Base layer, never delegated. Written only by the payout Magic Action.
#[account]
#[derive(InitSpace)]
pub struct AgentPayout {
    pub agent_id: u64,
    pub paid_total: u64,
    pub payouts: u64,
    pub last_paid_slot: u64,
    pub bump: u8,
}

/// Delegated. A client's prepaid balance; its USDC sits in the program vault on base.
#[account]
#[derive(InitSpace)]
pub struct Tab {
    pub client: Pubkey,
    pub deposited: u64,
    pub spent: u64,
    /// The first 8 bytes of every call_id must equal this (LE); a closed receipt can never be recreated
    pub next_nonce: u64,
    pub open_receipts: u32,
    pub bump: u8,
}

/// Ephemeral account (ER only, sponsored by the Tab). One per paid call; closed by its review.
#[account]
#[derive(InitSpace)]
pub struct CallReceipt {
    pub client: Pubkey,
    pub agent_id: u64,
    pub amount: u64,
    pub resource_hash: [u8; 32],
    pub call_id: [u8; 16],
    pub slot: u64,
    pub reviewed: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ReviewerKind {
    Client,
    Operator,
}
