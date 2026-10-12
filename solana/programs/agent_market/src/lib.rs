//! Agent Market — x402-style pay-per-call for AI agents on MagicBlock Ephemeral Rollups.
//!
//! Base layer: Config, AgentProfile (identity + payee + stake), USDC vault, stake vault, AgentPayout.
//! Ephemeral Rollup: Tab (client prepaid balance), AgentStats (earnings + split reputation), Ledger (fee payer),
//! CallReceipt (ephemeral account, one per paid call).
//! ER → base: `checkpoint` commits Tab/AgentStats through the delegated Ledger + magic_fee_vault and attaches one
//! `payout` Magic Action per agent, which moves real USDC from the vault to the agent's payee.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::system_program::{transfer as sol_transfer, Transfer as SolTransfer};
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use ephemeral_rollups_sdk::anchor::{action, commit, delegate, ephemeral, ephemeral_accounts};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use magicblock_magic_program_api::args::ScheduleTaskArgs;
use magicblock_magic_program_api::instruction::MagicBlockInstruction;
use ephemeral_rollups_sdk::ephem::{CallHandler, MagicIntentBundleBuilder};
use ephemeral_rollups_sdk::{ActionArgs, ShortAccountMeta};

pub mod state;
use state::*;

declare_id!("AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu");

#[ephemeral]
#[program]
pub mod agent_market {
    use super::*;

    // ------------------------------------------------------------------ base layer: setup

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        operator: Pubkey,
        validator: Pubkey,
        checkpoint_every_calls: u32,
        checkpoint_every_secs: u32,
        unstake_cooldown_secs: i64,
    ) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.authority = ctx.accounts.authority.key();
        c.operator = operator;
        c.usdc_mint = ctx.accounts.usdc_mint.key();
        c.validator = validator;
        c.agent_count = 0;
        c.checkpoint_every_calls = checkpoint_every_calls;
        c.checkpoint_every_secs = checkpoint_every_secs;
        c.unstake_cooldown_secs = unstake_cooldown_secs;
        c.bump = ctx.bumps.config;
        c.vault_bump = ctx.bumps.vault;
        c.stake_vault_bump = ctx.bumps.stake_vault;
        let l = &mut ctx.accounts.ledger;
        l.bump = ctx.bumps.ledger;
        l.last_checkpoint_ts = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Lamports for the Ledger's commit / Magic Action fees on the fee-vault path. Base layer, before delegation.
    pub fn fund_ledger(ctx: Context<FundLedger>, lamports: u64) -> Result<()> {
        sol_transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                SolTransfer { from: ctx.accounts.authority.to_account_info(), to: ctx.accounts.ledger.to_account_info() },
            ),
            lamports,
        )
    }

    pub fn delegate_ledger(ctx: Context<DelegateLedger>) -> Result<()> {
        require_keys_eq!(ctx.accounts.validator.key(), ctx.accounts.config.validator, MarketError::WrongValidator);
        ctx.accounts.delegate_ledger(
            &ctx.accounts.authority,
            &[LEDGER_SEED],
            DelegateConfig { validator: Some(ctx.accounts.config.validator), ..Default::default() },
        )?;
        Ok(())
    }

    // ------------------------------------------------------------------ base layer: identity

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        agent_id: u64,
        name: String,
        skill: String,
        endpoint: String,
        price_units: u64,
        metadata_uri: String,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(agent_id == config.agent_count + 1, MarketError::BadAgentId);
        require!(!name.is_empty() && name.len() <= 48, MarketError::BadString);
        require!(!skill.is_empty() && skill.len() <= 32, MarketError::BadString);
        require!(!endpoint.is_empty() && endpoint.len() <= 160, MarketError::BadString);
        require!(metadata_uri.len() <= 200, MarketError::BadString);
        config.agent_count = agent_id;

        let p = &mut ctx.accounts.agent_profile;
        p.agent_id = agent_id;
        p.owner = ctx.accounts.owner.key();
        p.payee = ctx.accounts.payee.key();
        p.price_units = price_units;
        p.active = true;
        p.registered_at = Clock::get()?.unix_timestamp;
        p.bump = ctx.bumps.agent_profile;
        p.name = name;
        p.skill = skill;
        p.endpoint = endpoint;
        p.metadata_uri = metadata_uri;

        let s = &mut ctx.accounts.agent_stats;
        s.agent_id = agent_id;
        s.bump = ctx.bumps.agent_stats;
        let po = &mut ctx.accounts.agent_payout;
        po.agent_id = agent_id;
        po.bump = ctx.bumps.agent_payout;

        emit!(AgentRegistered { agent_id, owner: p.owner, payee: p.payee, price_units });
        Ok(())
    }

    pub fn update_agent(ctx: Context<OwnerOnly>, endpoint: String, price_units: u64, metadata_uri: String) -> Result<()> {
        require!(!endpoint.is_empty() && endpoint.len() <= 160, MarketError::BadString);
        require!(metadata_uri.len() <= 200, MarketError::BadString);
        let p = &mut ctx.accounts.agent_profile;
        p.endpoint = endpoint;
        p.price_units = price_units;
        p.metadata_uri = metadata_uri;
        emit!(AgentUpdated { agent_id: p.agent_id, price_units });
        Ok(())
    }

    pub fn set_payee(ctx: Context<SetPayee>) -> Result<()> {
        let p = &mut ctx.accounts.agent_profile;
        emit!(PayeeChanged { agent_id: p.agent_id, previous: p.payee, payee: ctx.accounts.payee.key() });
        p.payee = ctx.accounts.payee.key();
        Ok(())
    }

    pub fn transfer_agent_ownership(ctx: Context<OwnerOnly>, new_owner: Pubkey) -> Result<()> {
        require_keys_neq!(new_owner, Pubkey::default(), MarketError::BadOwner);
        let p = &mut ctx.accounts.agent_profile;
        emit!(OwnershipTransferred { agent_id: p.agent_id, previous: p.owner, owner: new_owner });
        p.owner = new_owner;
        Ok(())
    }

    /// Agent owner pause/resume; config authority may use it only as an emergency stop.
    pub fn set_active(ctx: Context<SetActive>, active: bool) -> Result<()> {
        let p = &mut ctx.accounts.agent_profile;
        let signer = ctx.accounts.signer.key();
        require!(signer == p.owner || signer == ctx.accounts.config.authority, MarketError::Unauthorized);
        p.active = active;
        emit!(ActiveSet { agent_id: p.agent_id, active, by: signer });
        Ok(())
    }

    // ------------------------------------------------------------------ base layer: stake

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, MarketError::ZeroAmount);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.owner_token.to_account_info(),
                    to: ctx.accounts.stake_vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;
        let p = &mut ctx.accounts.agent_profile;
        p.stake = p.stake.checked_add(amount).ok_or(MarketError::Overflow)?;
        emit!(Staked { agent_id: p.agent_id, amount, total: p.stake });
        Ok(())
    }

    pub fn request_unstake(ctx: Context<OwnerOnly>, amount: u64) -> Result<()> {
        let p = &mut ctx.accounts.agent_profile;
        require!(amount > 0 && amount <= p.stake, MarketError::BadAmount);
        p.unstake_pending = amount;
        p.unstake_requested_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let config = &ctx.accounts.config;
        let p = &mut ctx.accounts.agent_profile;
        require!(p.unstake_pending > 0, MarketError::NothingPending);
        require!(now >= p.unstake_requested_at + config.unstake_cooldown_secs, MarketError::CooldownActive);
        let amount = p.unstake_pending.min(p.stake);
        p.stake -= amount;
        p.unstake_pending = 0;
        vault_transfer(&ctx.accounts.token_program, &ctx.accounts.stake_vault, &ctx.accounts.owner_token, config, amount)?;
        emit!(Unstaked { agent_id: p.agent_id, amount, total: p.stake });
        Ok(())
    }

    pub fn slash(ctx: Context<Slash>, amount: u64, reason: String) -> Result<()> {
        require!(reason.len() <= 200, MarketError::BadString);
        let config = &ctx.accounts.config;
        let p = &mut ctx.accounts.agent_profile;
        require!(amount > 0 && amount <= p.stake, MarketError::BadAmount);
        p.stake -= amount;
        p.unstake_pending = p.unstake_pending.min(p.stake);
        p.slashed_total = p.slashed_total.saturating_add(amount);
        vault_transfer(&ctx.accounts.token_program, &ctx.accounts.stake_vault, &ctx.accounts.recipient, config, amount)?;
        emit!(Slashed { agent_id: p.agent_id, amount, reason });
        Ok(())
    }

    // ------------------------------------------------------------------ base layer: tabs

    /// Deposit USDC into the vault and credit the client's Tab. `sponsor_lamports` funds the Tab so it can pay
    /// ER rent for the ephemeral CallReceipts it sponsors. Only while the Tab is not delegated.
    pub fn open_tab(ctx: Context<OpenTab>, amount: u64, sponsor_lamports: u64) -> Result<()> {
        if amount > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.key(),
                    Transfer {
                        from: ctx.accounts.client_token.to_account_info(),
                        to: ctx.accounts.vault.to_account_info(),
                        authority: ctx.accounts.client.to_account_info(),
                    },
                ),
                amount,
            )?;
        }
        if sponsor_lamports > 0 {
            sol_transfer(
                CpiContext::new(
                    ctx.accounts.system_program.key(),
                    SolTransfer { from: ctx.accounts.client.to_account_info(), to: ctx.accounts.tab.to_account_info() },
                ),
                sponsor_lamports,
            )?;
        }
        let t = &mut ctx.accounts.tab;
        if t.client == Pubkey::default() {
            t.client = ctx.accounts.client.key();
            t.bump = ctx.bumps.tab;
        }
        t.deposited = t.deposited.checked_add(amount).ok_or(MarketError::Overflow)?;
        emit!(TabOpened { client: t.client, amount, deposited: t.deposited });
        Ok(())
    }

    pub fn delegate_tab(ctx: Context<DelegateTab>) -> Result<()> {
        require_keys_eq!(ctx.accounts.validator.key(), ctx.accounts.config.validator, MarketError::WrongValidator);
        let client = ctx.accounts.client.key();
        ctx.accounts.delegate_tab(
            &ctx.accounts.client,
            &[TAB_SEED, client.as_ref()],
            DelegateConfig { validator: Some(ctx.accounts.config.validator), ..Default::default() },
        )?;
        Ok(())
    }

    pub fn delegate_agent_stats(ctx: Context<DelegateAgentStats>, agent_id: u64) -> Result<()> {
        require_keys_eq!(ctx.accounts.validator.key(), ctx.accounts.config.validator, MarketError::WrongValidator);
        ctx.accounts.delegate_agent_stats(
            &ctx.accounts.authority,
            &[STATS_SEED, &agent_id.to_le_bytes()],
            DelegateConfig { validator: Some(ctx.accounts.config.validator), ..Default::default() },
        )?;
        Ok(())
    }

    /// After undelegation: return the unspent balance and close the Tab.
    pub fn close_tab(ctx: Context<CloseTab>) -> Result<()> {
        let t = &ctx.accounts.tab;
        let refund = t.deposited.checked_sub(t.spent).ok_or(MarketError::Overflow)?;
        if refund > 0 {
            vault_transfer(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.client_token, &ctx.accounts.config, refund)?;
        }
        emit!(TabClosed { client: t.client, refund, spent: t.spent });
        Ok(())
    }

    // ------------------------------------------------------------------ base layer: Magic Action target

    /// Runs on base after a checkpoint commit. Pays `earned_total - paid_total` from the vault to the payee.
    /// Idempotent: a retried or duplicated action pays 0. Only reachable through a post-commit action scheduled
    /// by this program (escrow signer bound to the Ledger PDA).
    pub fn payout(ctx: Context<Payout>) -> Result<()> {
        let stats = {
            let data = ctx.accounts.agent_stats.try_borrow_data()?;
            AgentStats::try_deserialize(&mut &data[..])?
        };
        require!(stats.agent_id == ctx.accounts.agent_profile.agent_id, MarketError::BadAgentId);
        let po = &mut ctx.accounts.agent_payout;
        let owed = stats.earned_total.saturating_sub(po.paid_total);
        if owed > 0 {
            vault_transfer(&ctx.accounts.token_program, &ctx.accounts.vault, &ctx.accounts.payee, &ctx.accounts.config, owed)?;
            po.paid_total = stats.earned_total;
            po.payouts += 1;
            po.last_paid_slot = Clock::get()?.slot;
        }
        emit!(PaidOut { agent_id: stats.agent_id, amount: owed, paid_total: po.paid_total, payee: ctx.accounts.payee.key() });
        Ok(())
    }

    // ------------------------------------------------------------------ ER: per-call

    /// Pay for one agent call from the Tab, credit the agent and create its CallReceipt — atomically, on the ER.
    pub fn pay_for_call(
        ctx: Context<PayForCall>,
        agent_id: u64,
        amount: u64,
        call_id: [u8; 16],
        resource_hash: [u8; 32],
    ) -> Result<()> {
        let profile = &ctx.accounts.agent_profile;
        require!(profile.active, MarketError::AgentInactive);
        require!(amount >= profile.price_units, MarketError::Underpaid);
        {
            let tab = &ctx.accounts.tab;
            require!(call_id[..8] == tab.next_nonce.to_le_bytes(), MarketError::StaleCallId);
            let available = tab.deposited.checked_sub(tab.spent).ok_or(MarketError::Overflow)?;
            require!(available >= amount, MarketError::InsufficientTab);
        }
        // Receipt PDA = [receipt, client, next_nonce] = [receipt, client, call_id[..8]]; create it before the
        // nonce advances (the generated helper re-derives the seeds from the Tab). Fails if it already exists.
        ctx.accounts.create_ephemeral_receipt((8 + CallReceipt::INIT_SPACE) as u32)?;

        let tab = &mut ctx.accounts.tab;
        tab.spent += amount;
        tab.next_nonce += 1;
        tab.open_receipts += 1;
        let client = tab.client;

        let s = &mut ctx.accounts.agent_stats;
        s.earned_total = s.earned_total.checked_add(amount).ok_or(MarketError::Overflow)?;
        s.paid_calls += 1;

        let l = &mut ctx.accounts.ledger;
        l.calls_since_checkpoint += 1;
        l.total_calls += 1;

        let slot = Clock::get()?.slot;
        let receipt = CallReceipt { client, agent_id, amount, resource_hash, call_id, slot, reviewed: false };
        let mut data = ctx.accounts.receipt.try_borrow_mut_data()?;
        receipt.try_serialize(&mut &mut data[..])?;

        emit!(PaidCall { agent_id, client, amount, call_id, resource_hash, slot });
        Ok(())
    }

    /// One review per paid call. Operator key → Operator (only for calls the operator paid for);
    /// the paying client → Client (independent). Closes the receipt; its ER rent returns to the Tab.
    pub fn submit_feedback(ctx: Context<SubmitFeedback>, agent_id: u64, call_id: [u8; 16], score: u8) -> Result<()> {
        require!(score <= MAX_SCORE, MarketError::BadScore);
        require_keys_eq!(ctx.accounts.receipt.key(), receipt_address(&ctx.accounts.tab.client, &call_id), MarketError::NoReceipt);
        let receipt = {
            let data = ctx.accounts.receipt.try_borrow_data()?;
            require!(!data.is_empty(), MarketError::NoReceipt);
            CallReceipt::try_deserialize(&mut &data[..]).map_err(|_| error!(MarketError::NoReceipt))?
        };
        require!(receipt.call_id == call_id && receipt.agent_id == agent_id, MarketError::NoReceipt);
        require!(!receipt.reviewed, MarketError::AlreadyReviewed);

        let reviewer = ctx.accounts.reviewer.key();
        let kind = if reviewer == ctx.accounts.config.operator {
            require_keys_eq!(receipt.client, reviewer, MarketError::NotOperatorCall);
            ReviewerKind::Operator
        } else {
            require_keys_eq!(receipt.client, reviewer, MarketError::NotPayer);
            require!(reviewer != ctx.accounts.agent_profile.owner && reviewer != ctx.accounts.config.authority, MarketError::SelfReview);
            ReviewerKind::Client
        };

        let s = &mut ctx.accounts.agent_stats;
        match kind {
            ReviewerKind::Client => {
                s.client_score_sum += score as u64;
                s.client_reviews += 1;
            }
            ReviewerKind::Operator => {
                s.operator_score_sum += score as u64;
                s.operator_reviews += 1;
            }
        }
        let t = &mut ctx.accounts.tab;
        t.open_receipts = t.open_receipts.saturating_sub(1);
        ctx.accounts.close_ephemeral_receipt()?;
        emit!(FeedbackSubmitted { agent_id, call_id, reviewer, kind, score });
        Ok(())
    }

    /// The client gives up reviewing a call: closes its receipt so the ER rent returns to the Tab.
    pub fn discard_receipt(ctx: Context<DiscardReceipt>, call_id: [u8; 16]) -> Result<()> {
        require_keys_eq!(ctx.accounts.receipt.key(), receipt_address(&ctx.accounts.client.key(), &call_id), MarketError::NoReceipt);
        require!(!ctx.accounts.receipt.data_is_empty(), MarketError::NoReceipt);
        let t = &mut ctx.accounts.tab;
        t.open_receipts = t.open_receipts.saturating_sub(1);
        ctx.accounts.close_ephemeral_receipt()?;
        Ok(())
    }

    // ------------------------------------------------------------------ ER: checkpoint, crank, exits

    /// Commit AgentStats (+ any Tabs) to base through the delegated Ledger and the validator's magic_fee_vault,
    /// and attach one `payout` Magic Action per agent. remaining_accounts = [stats, profile] × agent_count, then tabs.
    /// Permissionless (so a crank can call it) but rate-limited; the config authority can force it.
    pub fn checkpoint<'info>(ctx: Context<'info, Checkpoint<'info>>, agent_count: u8) -> Result<()> {
        let config = &ctx.accounts.config;
        let now = Clock::get()?.unix_timestamp;
        let forced = ctx.accounts.caller.as_ref().map(|c| c.key() == config.authority).unwrap_or(false);
        {
            let l = &ctx.accounts.ledger;
            let due_calls = l.calls_since_checkpoint >= config.checkpoint_every_calls as u64;
            let due_time = l.calls_since_checkpoint > 0 && now - l.last_checkpoint_ts >= config.checkpoint_every_secs as i64;
            if !(forced || due_calls || due_time) {
                msg!("checkpoint not due: {} calls since last", l.calls_since_checkpoint);
                return Ok(());
            }
        }

        let (expected_vault, _) =
            Pubkey::find_program_address(&[b"magic-fee-vault", config.validator.as_ref()], &ephemeral_rollups_sdk::id());
        require_keys_eq!(ctx.accounts.magic_fee_vault.key(), expected_vault, MarketError::WrongFeeVault);

        let rem = ctx.remaining_accounts;
        let n = agent_count as usize;
        require!(rem.len() >= 2 * n, MarketError::BadRemainingAccounts);

        let (vault, _) = Pubkey::find_program_address(&[VAULT_SEED], &crate::ID);
        let mut commit: Vec<AccountInfo<'info>> = Vec::with_capacity(rem.len() - n);
        let mut actions: Vec<CallHandler<'info>> = Vec::with_capacity(n);
        for i in 0..n {
            let stats_ai = &rem[2 * i];
            let profile_ai = &rem[2 * i + 1];
            let profile = {
                let data = profile_ai.try_borrow_data()?;
                AgentProfile::try_deserialize(&mut &data[..])?
            };
            let id = profile.agent_id.to_le_bytes();
            require_keys_eq!(stats_ai.key(), Pubkey::find_program_address(&[STATS_SEED, &id], &crate::ID).0, MarketError::BadRemainingAccounts);
            require_keys_eq!(profile_ai.key(), Pubkey::find_program_address(&[AGENT_SEED, &id], &crate::ID).0, MarketError::BadRemainingAccounts);
            commit.push(stats_ai.clone());

            let accounts = vec![
                ShortAccountMeta { pubkey: config.key().to_bytes().into(), is_writable: false },
                ShortAccountMeta { pubkey: profile_ai.key().to_bytes().into(), is_writable: false },
                ShortAccountMeta { pubkey: stats_ai.key().to_bytes().into(), is_writable: false },
                ShortAccountMeta {
                    pubkey: Pubkey::find_program_address(&[PAYOUT_SEED, &id], &crate::ID).0.to_bytes().into(),
                    is_writable: true,
                },
                ShortAccountMeta { pubkey: vault.to_bytes().into(), is_writable: true },
                ShortAccountMeta { pubkey: profile.payee.to_bytes().into(), is_writable: true },
                ShortAccountMeta { pubkey: anchor_spl::token::ID.to_bytes().into(), is_writable: false },
            ];
            actions.push(CallHandler {
                destination_program: crate::ID,
                accounts,
                args: ActionArgs::new(anchor_lang::InstructionData::data(&crate::instruction::Payout {})),
                escrow_authority: ctx.accounts.ledger.to_account_info(),
                compute_units: 120_000,
            });
        }
        for tab in &rem[2 * n..] {
            commit.push(tab.clone());
        }

        {
            let l = &mut ctx.accounts.ledger;
            l.calls_since_checkpoint = 0;
            l.last_checkpoint_ts = now;
            l.checkpoints += 1;
        }
        emit!(CheckpointScheduled { agents: agent_count, tabs: (rem.len() - 2 * n) as u8, forced, at: now });

        let bump = ctx.accounts.ledger.bump;
        let seeds: &[&[u8]] = &[LEDGER_SEED, &[bump]];
        MagicIntentBundleBuilder::new(
            ctx.accounts.ledger.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .magic_fee_vault(ctx.accounts.magic_fee_vault.to_account_info())
        .commit(&commit)
        .add_post_commit_actions(actions)
        .build_and_invoke_signed(&[seeds])?;
        Ok(())
    }

    /// Crank: ask the ER scheduler to run `checkpoint` every `interval_ms`. remaining_accounts are the exact
    /// accounts `checkpoint` needs (see `Checkpoint` + its remaining accounts), in order.
    pub fn schedule_checkpoints<'info>(
        ctx: Context<'info, ScheduleCheckpoints<'info>>,
        task_id: i64,
        interval_ms: i64,
        iterations: i64,
        agent_count: u8,
    ) -> Result<()> {
        let rem = ctx.remaining_accounts;
        // Fixed checkpoint prefix (IDL order): ledger, config, magic_fee_vault, program_id, caller (None = program id),
        // magic_program, magic_context — then [stats, profile] × agent_count, then tabs
        require!(rem.len() >= 7 + 2 * agent_count as usize, MarketError::BadRemainingAccounts);
        let metas: Vec<AccountMeta> = rem
            .iter()
            .map(|a| if a.is_writable { AccountMeta::new(a.key(), false) } else { AccountMeta::new_readonly(a.key(), false) })
            .collect();
        let ix = Instruction {
            program_id: crate::ID,
            accounts: metas,
            data: anchor_lang::InstructionData::data(&crate::instruction::Checkpoint { agent_count }),
        };
        // Same instruction ScheduleCrankCpi builds (payer first, then the scheduled ix's accounts), invoked directly
        // because ScheduleCrankCpi needs 'info-lived slices and our account list is assembled at runtime.
        let args = ScheduleTaskArgs { task_id, execution_interval_millis: interval_ms, iterations, instructions: vec![ix] };
        let mut metas = vec![AccountMeta::new(ctx.accounts.authority.key(), true)];
        metas.extend(rem.iter().map(|a| AccountMeta { pubkey: a.key(), is_signer: a.is_signer, is_writable: a.is_writable }));
        let schedule = Instruction::new_with_bincode(ctx.accounts.magic_program.key(), &MagicBlockInstruction::ScheduleTask(args), metas);
        let mut infos = vec![ctx.accounts.authority.to_account_info()];
        infos.extend(rem.iter().cloned());
        anchor_lang::solana_program::program::invoke(&schedule, &infos)?;
        Ok(())
    }

    pub fn undelegate_tab(ctx: Context<UndelegateTab>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.client.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.tab.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn undelegate_agent_stats(ctx: Context<UndelegateAgentStats>, _agent_id: u64) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.agent_stats.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn undelegate_ledger(ctx: Context<UndelegateLedger>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.ledger.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

/// CallReceipt PDA for a call: [receipt, client, call_id[..8]] (the Tab nonce the call consumed)
pub fn receipt_address(client: &Pubkey, call_id: &[u8; 16]) -> Pubkey {
    Pubkey::find_program_address(&[RECEIPT_SEED, client.as_ref(), &call_id[..8]], &crate::ID).0
}

fn vault_transfer<'info>(
    token_program: &Program<'info, Token>,
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    config: &Account<'info, Config>,
    amount: u64,
) -> Result<()> {
    let seeds: &[&[u8]] = &[CONFIG_SEED, &[config.bump]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.key(),
            Transfer { from: from.to_account_info(), to: to.to_account_info(), authority: config.to_account_info() },
            &[seeds],
        ),
        amount,
    )
}

// ====================================================================== contexts: base layer

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = authority, space = 8 + Ledger::INIT_SPACE, seeds = [LEDGER_SEED], bump)]
    pub ledger: Account<'info, Ledger>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(init, payer = authority, seeds = [VAULT_SEED], bump, token::mint = usdc_mint, token::authority = config)]
    pub vault: Account<'info, TokenAccount>,
    #[account(init, payer = authority, seeds = [STAKE_VAULT_SEED], bump, token::mint = usdc_mint, token::authority = config)]
    pub stake_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundLedger<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [LEDGER_SEED], bump = ledger.bump)]
    pub ledger: Account<'info, Ledger>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateLedger<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority)]
    pub config: Account<'info, Config>,
    /// CHECK: Ledger PDA, delegated via the seeds passed to the CPI.
    #[account(mut, del, seeds = [LEDGER_SEED], bump)]
    pub ledger: UncheckedAccount<'info>,
    /// CHECK: must equal config.validator
    pub validator: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(agent_id: u64)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = owner, space = 8 + AgentProfile::INIT_SPACE, seeds = [AGENT_SEED, &agent_id.to_le_bytes()], bump)]
    pub agent_profile: Account<'info, AgentProfile>,
    #[account(init, payer = owner, space = 8 + AgentStats::INIT_SPACE, seeds = [STATS_SEED, &agent_id.to_le_bytes()], bump)]
    pub agent_stats: Account<'info, AgentStats>,
    #[account(init, payer = owner, space = 8 + AgentPayout::INIT_SPACE, seeds = [PAYOUT_SEED, &agent_id.to_le_bytes()], bump)]
    pub agent_payout: Account<'info, AgentPayout>,
    #[account(
        constraint = payee.owner == owner.key() @ MarketError::BadPayee,
        constraint = payee.mint == config.usdc_mint @ MarketError::BadPayee
    )]
    pub payee: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OwnerOnly<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [AGENT_SEED, &agent_profile.agent_id.to_le_bytes()], bump = agent_profile.bump, has_one = owner @ MarketError::Unauthorized)]
    pub agent_profile: Account<'info, AgentProfile>,
}

#[derive(Accounts)]
pub struct SetPayee<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [AGENT_SEED, &agent_profile.agent_id.to_le_bytes()], bump = agent_profile.bump, has_one = owner @ MarketError::Unauthorized)]
    pub agent_profile: Account<'info, AgentProfile>,
    #[account(
        constraint = payee.owner == owner.key() @ MarketError::BadPayee,
        constraint = payee.mint == config.usdc_mint @ MarketError::BadPayee
    )]
    pub payee: Account<'info, TokenAccount>,
}

#[derive(Accounts)]
pub struct SetActive<'info> {
    pub signer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [AGENT_SEED, &agent_profile.agent_id.to_le_bytes()], bump = agent_profile.bump)]
    pub agent_profile: Account<'info, AgentProfile>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [AGENT_SEED, &agent_profile.agent_id.to_le_bytes()], bump = agent_profile.bump, has_one = owner @ MarketError::Unauthorized)]
    pub agent_profile: Account<'info, AgentProfile>,
    #[account(mut, token::mint = config.usdc_mint, token::authority = owner)]
    pub owner_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [STAKE_VAULT_SEED], bump = config.stake_vault_bump)]
    pub stake_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [AGENT_SEED, &agent_profile.agent_id.to_le_bytes()], bump = agent_profile.bump, has_one = owner @ MarketError::Unauthorized)]
    pub agent_profile: Account<'info, AgentProfile>,
    #[account(mut, token::mint = config.usdc_mint, token::authority = owner)]
    pub owner_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [STAKE_VAULT_SEED], bump = config.stake_vault_bump)]
    pub stake_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Slash<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ MarketError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [AGENT_SEED, &agent_profile.agent_id.to_le_bytes()], bump = agent_profile.bump)]
    pub agent_profile: Account<'info, AgentProfile>,
    #[account(mut, seeds = [STAKE_VAULT_SEED], bump = config.stake_vault_bump)]
    pub stake_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = config.usdc_mint)]
    pub recipient: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct OpenTab<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(init_if_needed, payer = client, space = 8 + Tab::INIT_SPACE, seeds = [TAB_SEED, client.key().as_ref()], bump)]
    pub tab: Account<'info, Tab>,
    #[account(mut, token::mint = config.usdc_mint, token::authority = client)]
    pub client_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [VAULT_SEED], bump = config.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateTab<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    /// CHECK: the client's Tab PDA, delegated via the seeds passed to the CPI.
    #[account(mut, del, seeds = [TAB_SEED, client.key().as_ref()], bump)]
    pub tab: UncheckedAccount<'info>,
    /// CHECK: must equal config.validator
    pub validator: UncheckedAccount<'info>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(agent_id: u64)]
pub struct DelegateAgentStats<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ MarketError::Unauthorized)]
    pub config: Account<'info, Config>,
    /// CHECK: AgentStats PDA, delegated via the seeds passed to the CPI.
    #[account(mut, del, seeds = [STATS_SEED, &agent_id.to_le_bytes()], bump)]
    pub agent_stats: UncheckedAccount<'info>,
    /// CHECK: must equal config.validator
    pub validator: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CloseTab<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, close = client, seeds = [TAB_SEED, client.key().as_ref()], bump = tab.bump, has_one = client)]
    pub tab: Account<'info, Tab>,
    #[account(mut, token::mint = config.usdc_mint, token::authority = client)]
    pub client_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [VAULT_SEED], bump = config.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// Magic Action target. `#[action]` makes it dispatchable from a post-commit action; the escrow signer bound to
/// the Ledger PDA is what restricts it to actions this program scheduled (a direct call cannot sign for `escrow`).
#[action]
#[derive(Accounts)]
pub struct Payout<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [AGENT_SEED, &agent_profile.agent_id.to_le_bytes()], bump = agent_profile.bump)]
    pub agent_profile: Account<'info, AgentProfile>,
    /// CHECK: delegated (owned by the delegation program on base); PDA checked here, data deserialized in the handler
    #[account(seeds = [STATS_SEED, &agent_profile.agent_id.to_le_bytes()], bump)]
    pub agent_stats: UncheckedAccount<'info>,
    #[account(mut, seeds = [PAYOUT_SEED, &agent_profile.agent_id.to_le_bytes()], bump = agent_payout.bump)]
    pub agent_payout: Account<'info, AgentPayout>,
    #[account(mut, seeds = [VAULT_SEED], bump = config.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, address = agent_profile.payee @ MarketError::BadPayee)]
    pub payee: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    /// CHECK: the Ledger PDA — the only escrow authority this program schedules payouts with
    #[account(seeds = [LEDGER_SEED], bump)]
    pub escrow_auth: UncheckedAccount<'info>,
    /// CHECK: only the delegation program can sign for this PDA, so `signer` proves the post-commit action path
    #[account(
        signer @ MarketError::Unauthorized,
        address = ephemeral_rollups_sdk::pda::ephemeral_balance_pda_from_payer(&escrow_auth.key(), ACTION_ESCROW_INDEX) @ MarketError::Unauthorized,
    )]
    pub escrow: UncheckedAccount<'info>,
}

// ====================================================================== contexts: ER

#[ephemeral_accounts]
#[derive(Accounts)]
#[instruction(agent_id: u64)]
pub struct PayForCall<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(mut, sponsor, seeds = [TAB_SEED, client.key().as_ref()], bump = tab.bump, has_one = client)]
    pub tab: Account<'info, Tab>,
    #[account(seeds = [AGENT_SEED, &agent_id.to_le_bytes()], bump = agent_profile.bump)]
    pub agent_profile: Account<'info, AgentProfile>,
    #[account(mut, seeds = [STATS_SEED, &agent_id.to_le_bytes()], bump = agent_stats.bump)]
    pub agent_stats: Account<'info, AgentStats>,
    #[account(mut, seeds = [LEDGER_SEED], bump = ledger.bump)]
    pub ledger: Account<'info, Ledger>,
    /// CHECK: ephemeral CallReceipt at [receipt, client, nonce]; creation fails if it already exists (replay protection)
    #[account(mut, eph, seeds = [RECEIPT_SEED, client.key().as_ref(), &tab.next_nonce.to_le_bytes()], bump)]
    pub receipt: UncheckedAccount<'info>,
}

#[ephemeral_accounts]
#[derive(Accounts)]
#[instruction(agent_id: u64)]
pub struct SubmitFeedback<'info> {
    #[account(mut)]
    pub reviewer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, sponsor, seeds = [TAB_SEED, tab.client.as_ref()], bump = tab.bump)]
    pub tab: Account<'info, Tab>,
    #[account(seeds = [AGENT_SEED, &agent_id.to_le_bytes()], bump = agent_profile.bump)]
    pub agent_profile: Account<'info, AgentProfile>,
    #[account(mut, seeds = [STATS_SEED, &agent_id.to_le_bytes()], bump = agent_stats.bump)]
    pub agent_stats: Account<'info, AgentStats>,
    /// CHECK: ephemeral CallReceipt; address checked against receipt_address(client, call_id) in the handler
    #[account(mut, eph)]
    pub receipt: UncheckedAccount<'info>,
}

#[ephemeral_accounts]
#[derive(Accounts)]
pub struct DiscardReceipt<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(mut, sponsor, seeds = [TAB_SEED, client.key().as_ref()], bump = tab.bump, has_one = client)]
    pub tab: Account<'info, Tab>,
    /// CHECK: ephemeral CallReceipt; address checked against receipt_address(client, call_id) in the handler
    #[account(mut, eph)]
    pub receipt: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct Checkpoint<'info> {
    #[account(mut, seeds = [LEDGER_SEED], bump = ledger.bump)]
    pub ledger: Account<'info, Ledger>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    /// CHECK: validator-scoped magic fee vault, checked against config.validator in the handler
    #[account(mut)]
    pub magic_fee_vault: UncheckedAccount<'info>,
    /// CHECK: destination program for the scheduled payout actions
    #[account(address = crate::ID)]
    pub program_id: UncheckedAccount<'info>,
    /// Optional: the config authority forces a checkpoint; without it the call is rate-limited
    pub caller: Option<Signer<'info>>,
}

#[derive(Accounts)]
pub struct ScheduleCheckpoints<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ MarketError::Unauthorized)]
    pub config: Account<'info, Config>,
    /// CHECK: Magic program, used for the ScheduleTask CPI
    #[account(address = ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateTab<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(mut, seeds = [TAB_SEED, client.key().as_ref()], bump = tab.bump, has_one = client)]
    pub tab: Account<'info, Tab>,
}

#[commit]
#[derive(Accounts)]
#[instruction(agent_id: u64)]
pub struct UndelegateAgentStats<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ MarketError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [STATS_SEED, &agent_id.to_le_bytes()], bump = agent_stats.bump)]
    pub agent_stats: Account<'info, AgentStats>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateLedger<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ MarketError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [LEDGER_SEED], bump = ledger.bump)]
    pub ledger: Account<'info, Ledger>,
}

// ====================================================================== events & errors

#[event]
pub struct AgentRegistered {
    pub agent_id: u64,
    pub owner: Pubkey,
    pub payee: Pubkey,
    pub price_units: u64,
}
#[event]
pub struct AgentUpdated {
    pub agent_id: u64,
    pub price_units: u64,
}
#[event]
pub struct PayeeChanged {
    pub agent_id: u64,
    pub previous: Pubkey,
    pub payee: Pubkey,
}
#[event]
pub struct OwnershipTransferred {
    pub agent_id: u64,
    pub previous: Pubkey,
    pub owner: Pubkey,
}
#[event]
pub struct ActiveSet {
    pub agent_id: u64,
    pub active: bool,
    pub by: Pubkey,
}
#[event]
pub struct Staked {
    pub agent_id: u64,
    pub amount: u64,
    pub total: u64,
}
#[event]
pub struct Unstaked {
    pub agent_id: u64,
    pub amount: u64,
    pub total: u64,
}
#[event]
pub struct Slashed {
    pub agent_id: u64,
    pub amount: u64,
    pub reason: String,
}
#[event]
pub struct TabOpened {
    pub client: Pubkey,
    pub amount: u64,
    pub deposited: u64,
}
#[event]
pub struct TabClosed {
    pub client: Pubkey,
    pub refund: u64,
    pub spent: u64,
}
#[event]
pub struct PaidCall {
    pub agent_id: u64,
    pub client: Pubkey,
    pub amount: u64,
    pub call_id: [u8; 16],
    pub resource_hash: [u8; 32],
    pub slot: u64,
}
#[event]
pub struct FeedbackSubmitted {
    pub agent_id: u64,
    pub call_id: [u8; 16],
    pub reviewer: Pubkey,
    pub kind: ReviewerKind,
    pub score: u8,
}
#[event]
pub struct CheckpointScheduled {
    pub agents: u8,
    pub tabs: u8,
    pub forced: bool,
    pub at: i64,
}
#[event]
pub struct PaidOut {
    pub agent_id: u64,
    pub amount: u64,
    pub paid_total: u64,
    pub payee: Pubkey,
}

#[error_code]
pub enum MarketError {
    #[msg("Not authorized")]
    Unauthorized,
    #[msg("agent_id must be agent_count + 1")]
    BadAgentId,
    #[msg("String empty or too long")]
    BadString,
    #[msg("Payee must be a USDC token account owned by the agent owner")]
    BadPayee,
    #[msg("Invalid owner")]
    BadOwner,
    #[msg("Amount must be > 0")]
    ZeroAmount,
    #[msg("Invalid amount")]
    BadAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("No unstake pending")]
    NothingPending,
    #[msg("Unstake cooldown still active")]
    CooldownActive,
    #[msg("Validator does not match the pinned ER validator")]
    WrongValidator,
    #[msg("Agent is not active")]
    AgentInactive,
    #[msg("Amount is below the agent's price")]
    Underpaid,
    #[msg("Tab balance too low")]
    InsufficientTab,
    #[msg("call_id must start with the Tab's next nonce")]
    StaleCallId,
    #[msg("Score must be 0-100")]
    BadScore,
    #[msg("No receipt for this call")]
    NoReceipt,
    #[msg("Call already reviewed")]
    AlreadyReviewed,
    #[msg("Operator can only review calls it paid for")]
    NotOperatorCall,
    #[msg("Only the paying client can review this call")]
    NotPayer,
    #[msg("The agent's owner or the market authority cannot write a client review")]
    SelfReview,
    #[msg("magic_fee_vault is not the pinned validator's fee vault")]
    WrongFeeVault,
    #[msg("Bad remaining accounts")]
    BadRemainingAccounts,
}
