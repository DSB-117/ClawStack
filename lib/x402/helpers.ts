/**
 * x402 Protocol Helper Functions
 *
 * Utilities for generating payment options, memos, and validity windows.
 *
 * @see claude/knowledge/prd.md Section 2.2 (x402 Payment Flow)
 * @see claude/operations/tasks.md Tasks 2.3.2-2.3.4
 */

import { PaymentOption, X402_CONFIG, PaymentChain } from './types';

// ============================================
// 2.3.2: Generate Payment Memo with Timestamp
// ============================================

/**
 * Generate a payment memo for Solana transactions.
 * Format: "clawstack:{postId}:{unixTimestamp}"
 *
 * The memo is included in the Solana transaction and used to:
 * 1. Associate the payment with a specific post
 * 2. Prevent replay attacks by including timestamp
 * 3. Enable verification by checking memo matches expected format
 *
 * @param resourceId - The post ID or resource identifier
 * @param resourceType - Type of resource (default: 'post')
 * @returns Formatted memo string
 *
 * @example
 * generatePaymentMemo('abc123')
 * // Returns: "clawstack:abc123:1706960000"
 */
export function generatePaymentMemo(
  resourceId: string,
  resourceType: string = 'post'
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return `${X402_CONFIG.MEMO_PREFIX}:${resourceId}:${timestamp}`;
}

/**
 * Generate a spam fee memo for anti-spam payments.
 *
 * @param agentId - The agent ID paying the spam fee
 * @returns Formatted memo string for spam fee
 */
export function generateSpamFeeMemo(agentId: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return `${X402_CONFIG.MEMO_PREFIX}:spam_fee:${agentId}:${timestamp}`;
}

// ============================================
// 2.3.3: Calculate Payment Validity Window
// ============================================

/**
 * Get the payment validity expiration timestamp.
 * Returns ISO 8601 formatted timestamp 5 minutes from now.
 *
 * @param validitySeconds - Optional override for validity window (default: 300)
 * @returns ISO 8601 timestamp string
 *
 * @example
 * getPaymentValidUntil()
 * // Returns: "2026-02-03T12:30:00.000Z"
 */
export function getPaymentValidUntil(
  validitySeconds: number = X402_CONFIG.PAYMENT_VALIDITY_SECONDS
): string {
  const validUntil = new Date(Date.now() + validitySeconds * 1000);
  return validUntil.toISOString();
}

/**
 * Check if a payment timestamp is within the validity window.
 *
 * @param memoTimestamp - Unix timestamp from the payment memo
 * @param validitySeconds - Maximum age in seconds (default: 300)
 * @returns True if timestamp is within validity window
 */
export function isPaymentTimestampValid(
  memoTimestamp: number,
  validitySeconds: number = X402_CONFIG.PAYMENT_VALIDITY_SECONDS
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const age = now - memoTimestamp;
  return age >= 0 && age <= validitySeconds;
}

// ============================================
// 2.3.4: Build Solana Payment Option Object
// ============================================

/**
 * Build a Solana payment option for the 402 response.
 * Contains all information needed for a client to construct a Solana transaction.
 *
 * @param postId - The post ID for memo generation
 * @returns Complete Solana payment option object
 *
 * @example
 * buildSolanaPaymentOption('abc123')
 * // Returns: {
 * //   chain: 'solana',
 * //   chain_id: 'mainnet-beta',
 * //   recipient: 'CStkPay111...',
 * //   token_mint: 'EPjFWdd5Aufq...',
 * //   token_symbol: 'USDC',
 * //   decimals: 6,
 * //   memo: 'clawstack:abc123:1706960000'
 * // }
 */
export function buildSolanaPaymentOption(postId: string): PaymentOption {
  const treasuryPubkey = process.env.SOLANA_TREASURY_PUBKEY;
  const usdcMint = process.env.USDC_MINT_SOLANA;

  if (!treasuryPubkey) {
    throw new Error('SOLANA_TREASURY_PUBKEY environment variable is not set');
  }

  if (!usdcMint) {
    throw new Error('USDC_MINT_SOLANA environment variable is not set');
  }

  return {
    chain: 'solana',
    chain_id: 'mainnet-beta',
    recipient: treasuryPubkey,
    token_mint: usdcMint,
    token_symbol: 'USDC',
    decimals: 6,
    memo: generatePaymentMemo(postId),
  };
}

/**
 * Build a Base (EVM) payment option for the 402 response.
 * Placeholder for Phase 3 implementation.
 *
 * @param postId - The post ID for reference generation
 * @returns Complete Base payment option object
 */
export function buildBasePaymentOption(postId: string): PaymentOption {
  const treasuryAddress = process.env.BASE_TREASURY_ADDRESS;
  const usdcContract = process.env.USDC_CONTRACT_BASE;

  if (!treasuryAddress) {
    throw new Error('BASE_TREASURY_ADDRESS environment variable is not set');
  }

  if (!usdcContract) {
    throw new Error('USDC_CONTRACT_BASE environment variable is not set');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const reference = `0xclawstack_${postId}_${timestamp}`;

  return {
    chain: 'base',
    chain_id: '8453',
    recipient: treasuryAddress,
    token_contract: usdcContract,
    token_symbol: 'USDC',
    decimals: 6,
    reference,
  };
}

/**
 * Build all available payment options for a post.
 * Returns both Solana and Base payment options by default.
 *
 * @param postId - The post ID
 * @param chains - Optional array of chains to include (default: ['solana', 'base'])
 * @returns Array of payment options
 */
export function buildPaymentOptions(
  postId: string,
  chains: PaymentChain[] = ['solana', 'base']
): PaymentOption[] {
  const options: PaymentOption[] = [];

  for (const chain of chains) {
    try {
      if (chain === 'solana') {
        options.push(buildSolanaPaymentOption(postId));
      } else if (chain === 'base') {
        options.push(buildBasePaymentOption(postId));
      }
    } catch (error) {
      // Log but don't fail if one chain is not configured
      console.warn(`Failed to build payment option for ${chain}:`, error);
    }
  }

  return options;
}

/**
 * Build payment options for spam fee payment.
 * Returns both Solana and Base payment options by default.
 *
 * @param agentId - The agent ID paying the spam fee
 * @param chains - Optional array of chains to include (default: ['solana', 'base'])
 * @returns Array of payment options for spam fee
 *
 * @see claude/operations/tasks.md Task 2.5.1
 */
export function buildSpamFeePaymentOptions(
  agentId: string,
  chains: PaymentChain[] = ['solana', 'base']
): PaymentOption[] {
  const options: PaymentOption[] = [];

  for (const chain of chains) {
    try {
      if (chain === 'solana') {
        const treasuryPubkey = process.env.SOLANA_TREASURY_PUBKEY;
        const usdcMint = process.env.USDC_MINT_SOLANA;

        if (!treasuryPubkey || !usdcMint) {
          throw new Error('Solana environment variables not configured');
        }

        options.push({
          chain: 'solana',
          chain_id: 'mainnet-beta',
          recipient: treasuryPubkey,
          token_mint: usdcMint,
          token_symbol: 'USDC',
          decimals: 6,
          memo: generateSpamFeeMemo(agentId),
        });
      } else if (chain === 'base') {
        // Phase 3: Add Base spam fee payment option
        const treasuryAddress = process.env.BASE_TREASURY_ADDRESS;
        const usdcContract = process.env.USDC_CONTRACT_BASE;

        if (!treasuryAddress || !usdcContract) {
          throw new Error('Base environment variables not configured');
        }

        const timestamp = Math.floor(Date.now() / 1000);
        options.push({
          chain: 'base',
          chain_id: '8453',
          recipient: treasuryAddress,
          token_contract: usdcContract,
          token_symbol: 'USDC',
          decimals: 6,
          reference: `0xclawstack_spam_fee_${agentId}_${timestamp}`,
        });
      }
    } catch (error) {
      console.warn(`Failed to build spam fee option for ${chain}:`, error);
    }
  }

  return options;
}

/**
 * Convert USDC amount from human-readable to raw units.
 * USDC has 6 decimal places.
 *
 * @param usdcAmount - Amount in USDC (e.g., 0.25)
 * @returns Amount in raw units as BigInt (e.g., 250000n)
 */
export function usdcToRaw(usdcAmount: number): bigint {
  return BigInt(Math.floor(usdcAmount * 1_000_000));
}

/**
 * Convert raw units to human-readable USDC amount.
 *
 * @param rawAmount - Amount in raw units (6 decimals)
 * @returns Amount in USDC as string with 2 decimal places
 */
export function rawToUsdc(rawAmount: bigint): string {
  const usdcAmount = Number(rawAmount) / 1_000_000;
  return usdcAmount.toFixed(2);
}
