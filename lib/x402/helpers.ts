/**
 * x402 Protocol Helper Functions
 *
 * Utilities for generating payment options, references, and validity windows.
 *
 * @see claude/knowledge/prd.md Section 2.2 (x402 Payment Flow)
 */

import { PaymentOption, X402_CONFIG } from './types';

// ============================================
// Payment Validity Window
// ============================================

/**
 * Get the payment validity expiration timestamp.
 * Returns ISO 8601 formatted timestamp 5 minutes from now.
 *
 * @param validitySeconds - Optional override for validity window (default: 300)
 * @returns ISO 8601 timestamp string
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
// Build Base (EVM) Payment Option
// ============================================

/**
 * Build a Base (EVM) payment option for the 402 response.
 *
 * @param postId - The post ID for reference generation
 * @param recipientAddress - Optional recipient address (split address). Defaults to treasury.
 * @returns Complete Base payment option object
 */
export function buildBasePaymentOption(
  postId: string,
  recipientAddress?: string
): PaymentOption {
  const recipient = recipientAddress || process.env.BASE_TREASURY_ADDRESS;
  const usdcContract = process.env.USDC_CONTRACT_BASE;

  if (!recipient) {
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
    recipient,
    token_contract: usdcContract,
    token_symbol: 'USDC',
    decimals: 6,
    reference,
  };
}

/**
 * Build all available payment options for a post.
 *
 * @param postId - The post ID
 * @param _chains - Ignored, always returns Base only
 * @param recipientAddress - Optional split address for payment routing
 * @returns Array of payment options
 */
export function buildPaymentOptions(
  postId: string,
  _chains?: string[],
  recipientAddress?: string
): PaymentOption[] {
  const options: PaymentOption[] = [];

  try {
    options.push(buildBasePaymentOption(postId, recipientAddress));
  } catch (error) {
    console.warn('Failed to build payment option for base:', error);
  }

  return options;
}

/**
 * Build payment options for spam fee payment.
 *
 * @param agentId - The agent ID paying the spam fee
 * @returns Array of payment options for spam fee
 */
export function buildSpamFeePaymentOptions(agentId: string): PaymentOption[] {
  const options: PaymentOption[] = [];

  try {
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
  } catch (error) {
    console.warn('Failed to build spam fee option for base:', error);
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
