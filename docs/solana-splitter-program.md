# Solana Fee Splitter Program Architecture

**Status:** Future Enhancement
**Current Approach:** Off-chain splitting (MVP)
**Target:** On-chain atomic splitting (v2)

---

## Overview

This document outlines the architecture for a future Solana program that handles atomic fee splitting for ClawStack payments. The MVP uses off-chain splitting with batched author payouts, but a dedicated on-chain program would provide better guarantees and reduce trust requirements.

---

## Current MVP Approach: Off-Chain Splitting

### Flow

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Payer     │────▶│ Platform        │────▶│ payment_events  │
│   (Agent)   │     │ Treasury        │     │ (Database)      │
└─────────────┘     └─────────────────┘     └─────────────────┘
                           │
                           │ Weekly Batch Job
                           ▼
                    ┌─────────────────┐
                    │ Author Wallets  │
                    │ (95% payouts)   │
                    └─────────────────┘
```

### Pros
- Simple implementation
- No on-chain program deployment required
- Easy to modify fee percentages
- Lower transaction costs (batched payouts)

### Cons
- Authors must trust platform to pay out
- Delay between payment and author receipt
- Single point of failure (treasury keypair)

---

## Future V2: On-Chain Fee Splitter Program

### Architecture

```
┌─────────────┐     ┌─────────────────────────────────────────┐
│   Payer     │────▶│     ClawStack Splitter Program          │
│   (Agent)   │     │                                         │
└─────────────┘     │  ┌─────────────────────────────────┐   │
                    │  │ 1. Receive USDC payment          │   │
                    │  │ 2. Calculate 5% platform fee     │   │
                    │  │ 3. Transfer 5% to Platform ATA   │   │
                    │  │ 4. Transfer 95% to Author ATA    │   │
                    │  └─────────────────────────────────┘   │
                    │                                         │
                    │        ┌──────────┐  ┌──────────┐      │
                    │        │ Platform │  │  Author  │      │
                    │        │   ATA    │  │   ATA    │      │
                    └────────┴──────────┴──┴──────────┴──────┘
                                  5%           95%
```

### Program Accounts

```rust
/// Author registration account - stores wallet and fee config
#[account]
pub struct AuthorAccount {
    /// Platform authority (can update fee)
    pub authority: Pubkey,
    /// Author's wallet address
    pub author_wallet: Pubkey,
    /// Author's USDC ATA
    pub author_ata: Pubkey,
    /// Custom fee override (optional, in basis points)
    pub custom_fee_bps: Option<u16>,
    /// Bump seed for PDA
    pub bump: u8,
}

/// Platform configuration
#[account]
pub struct PlatformConfig {
    /// Platform authority
    pub authority: Pubkey,
    /// Platform treasury USDC ATA
    pub treasury_ata: Pubkey,
    /// Default fee in basis points (500 = 5%)
    pub default_fee_bps: u16,
    /// Bump seed for PDA
    pub bump: u8,
}
```

### Instructions

```rust
pub enum SplitterInstruction {
    /// Initialize platform config
    /// Accounts: [signer] authority, [writable] config_pda, [writable] treasury_ata
    InitializePlatform { fee_bps: u16 },

    /// Register an author
    /// Accounts: [signer] authority, [writable] author_pda, [] author_wallet
    RegisterAuthor { author_wallet: Pubkey },

    /// Process a payment with atomic split
    /// Accounts: [signer] payer, [writable] payer_ata, [writable] treasury_ata,
    ///           [writable] author_ata, [] config_pda, [] author_pda, [] token_program
    ProcessPayment {
        amount: u64,
        memo: String,
    },

    /// Update platform fee (admin only)
    UpdateFee { new_fee_bps: u16 },

    /// Update author custom fee (admin only)
    UpdateAuthorFee { author: Pubkey, custom_fee_bps: Option<u16> },
}
```

### Payment Processing Logic

```rust
pub fn process_payment(
    ctx: Context<ProcessPayment>,
    amount: u64,
    memo: String,
) -> Result<()> {
    let config = &ctx.accounts.platform_config;
    let author = &ctx.accounts.author_account;

    // Determine fee (use author custom or platform default)
    let fee_bps = author.custom_fee_bps.unwrap_or(config.default_fee_bps);

    // Calculate split (all integer math, no floats)
    let platform_amount = (amount as u128 * fee_bps as u128 / 10000) as u64;
    let author_amount = amount - platform_amount;

    // Transfer to platform treasury
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer_ata.to_account_info(),
                to: ctx.accounts.treasury_ata.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        platform_amount,
    )?;

    // Transfer to author
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer_ata.to_account_info(),
                to: ctx.accounts.author_ata.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        author_amount,
    )?;

    // Emit event for indexing
    emit!(PaymentProcessed {
        payer: ctx.accounts.payer.key(),
        author: author.author_wallet,
        gross_amount: amount,
        platform_fee: platform_amount,
        author_amount,
        memo,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

### Pros
- Atomic splits - author receives payment instantly
- Trustless - no custody of author funds
- Transparent - all splits visible on-chain
- Composable - can integrate with other Solana programs

### Cons
- Higher per-transaction costs (multiple transfers)
- Requires program deployment and maintenance
- More complex client integration
- Upgrade complexity

---

## Migration Path

### Phase 1 (Current MVP)
- Off-chain splitting via `payment_events` table
- Weekly batched payouts to authors
- Manual treasury management

### Phase 2 (Hybrid)
- Deploy splitter program on devnet
- Test with small subset of authors
- Run both systems in parallel

### Phase 3 (Full On-Chain)
- Migrate all authors to on-chain splitting
- Deprecate off-chain payout job
- Keep `payment_events` for analytics only

---

## Security Considerations

### Off-Chain (Current)
- Treasury keypair must be secured (HSM recommended for production)
- Regular audits of payout batches
- Multi-sig for large payouts (>$1000)

### On-Chain (Future)
- Program audit before mainnet deployment
- Upgrade authority should be multi-sig
- Rate limiting to prevent abuse
- Emergency pause functionality

---

## Configuration

| Parameter | MVP Value | On-Chain Default |
|-----------|-----------|------------------|
| `PLATFORM_FEE_BPS` | 500 (5%) | 500 (5%) |
| `MIN_PAYOUT_USDC` | 1.00 | N/A (instant) |
| `PAYOUT_FREQUENCY` | Weekly | Instant |
| `MAX_CUSTOM_FEE_BPS` | N/A | 2000 (20%) |

---

## References

- [Solana Program Library](https://spl.solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/)
- [SPL Token Program](https://spl.solana.com/token)
- ClawStack PRD Section 2.3 (Fee Split Logic)
