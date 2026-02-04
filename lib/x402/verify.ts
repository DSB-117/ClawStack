/**
 * x402 Payment Verification Module
 *
 * Handles parsing of X-Payment-Proof headers and routing to
 * chain-specific verifiers (Solana/Base).
 *
 * @see claude/knowledge/prd.md Section 2.2 (x402 Payment Flow)
 * @see claude/operations/tasks.md Tasks 2.3.6-2.3.10
 */

import {
  PaymentProof,
  VerificationResult,
  PostForPayment,
  X402_CONFIG,
} from './types';
import { usdcToRaw, rawToUsdc } from './helpers';
import {
  verifyPayment as verifySolanaPayment,
  PaymentVerificationError,
} from '@/lib/solana/verify';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { Redis } from '@upstash/redis';

// ============================================
// Redis Client for Payment Caching
// ============================================

let redis: Redis | null = null;

/**
 * Get Redis client singleton.
 * Returns null if Upstash is not configured.
 */
function getRedis(): Redis | null {
  if (redis) return redis;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Upstash Redis not configured, payment caching disabled');
    return null;
  }

  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  return redis;
}

// ============================================
// 2.3.6: Parse X-Payment-Proof Header
// ============================================

/**
 * Parse the X-Payment-Proof header from a request.
 * Expected format: JSON with chain, transaction_signature, payer_address, timestamp
 *
 * @param header - The raw header value (may be null)
 * @returns Parsed PaymentProof or null if invalid/missing
 *
 * @example
 * parsePaymentProof('{"chain":"solana","transaction_signature":"5xK3v...","payer_address":"7sK9x...","timestamp":1706959800}')
 * // Returns: { chain: 'solana', transaction_signature: '5xK3v...', ... }
 */
export function parsePaymentProof(header: string | null): PaymentProof | null {
  if (!header) {
    return null;
  }

  try {
    const proof = JSON.parse(header);

    // Validate required fields
    if (!proof.chain || typeof proof.chain !== 'string') {
      console.warn('Payment proof missing or invalid chain');
      return null;
    }

    if (!proof.transaction_signature || typeof proof.transaction_signature !== 'string') {
      console.warn('Payment proof missing or invalid transaction_signature');
      return null;
    }

    if (!proof.payer_address || typeof proof.payer_address !== 'string') {
      console.warn('Payment proof missing or invalid payer_address');
      return null;
    }

    // Validate chain is supported
    if (proof.chain !== 'solana' && proof.chain !== 'base') {
      console.warn(`Unsupported payment chain: ${proof.chain}`);
      return null;
    }

    // Timestamp is optional but should be a number if present
    const timestamp = typeof proof.timestamp === 'number'
      ? proof.timestamp
      : Math.floor(Date.now() / 1000);

    return {
      chain: proof.chain,
      transaction_signature: proof.transaction_signature,
      payer_address: proof.payer_address,
      timestamp,
    };
  } catch (error) {
    console.warn('Failed to parse payment proof header:', error);
    return null;
  }
}

// ============================================
// 2.3.8: Payment Proof Caching
// ============================================

/** Cache TTL in seconds (1 hour) */
const CACHE_TTL_SECONDS = 3600;

/**
 * Generate cache key for a payment proof.
 */
function getPaymentCacheKey(network: string, signature: string): string {
  return `payment:verified:${network}:${signature}`;
}

/**
 * Check if a payment has already been verified and cached.
 *
 * @param network - The blockchain network
 * @param signature - The transaction signature
 * @returns True if payment is cached as verified
 */
export async function checkPaymentCache(
  network: string,
  signature: string
): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    const cached = await client.get(getPaymentCacheKey(network, signature));
    return cached === 'true';
  } catch (error) {
    console.warn('Payment cache check failed:', error);
    return false;
  }
}

/**
 * Cache a verified payment to avoid re-verification.
 *
 * @param network - The blockchain network
 * @param signature - The transaction signature
 */
export async function cacheVerifiedPayment(
  network: string,
  signature: string
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.setex(
      getPaymentCacheKey(network, signature),
      CACHE_TTL_SECONDS,
      'true'
    );
  } catch (error) {
    console.warn('Failed to cache verified payment:', error);
  }
}

// ============================================
// 2.3.7: Route to Chain-Specific Verifier
// ============================================

/**
 * Verify a payment proof by routing to the appropriate chain verifier.
 * Currently supports Solana; Base will be added in Phase 3.
 *
 * @param proof - The parsed payment proof
 * @param post - The post being accessed
 * @returns Verification result
 */
export async function verifyPayment(
  proof: PaymentProof,
  post: PostForPayment
): Promise<VerificationResult> {
  // Check cache first
  const isCached = await checkPaymentCache(proof.chain, proof.transaction_signature);
  if (isCached) {
    return {
      success: true,
      payment: {
        signature: proof.transaction_signature,
        payer: proof.payer_address,
        recipient: proof.chain === 'solana'
          ? process.env.SOLANA_TREASURY_PUBKEY || ''
          : process.env.BASE_TREASURY_ADDRESS || '',
        amount_raw: usdcToRaw(post.price_usdc || 0),
        amount_usdc: (post.price_usdc || 0).toFixed(2),
        network: proof.chain,
        chain_id: proof.chain === 'solana' ? 'mainnet-beta' : '8453',
      },
    };
  }

  // Route to appropriate verifier
  switch (proof.chain) {
    case 'solana':
      return verifySolanaPaymentProof(proof, post);
    case 'base':
      return verifyBasePaymentProof(proof, post);
    default:
      return {
        success: false,
        error: `Unsupported payment chain: ${proof.chain}`,
        error_code: 'UNSUPPORTED_CHAIN',
      };
  }
}

/**
 * Verify a Solana payment proof.
 */
async function verifySolanaPaymentProof(
  proof: PaymentProof,
  post: PostForPayment
): Promise<VerificationResult> {
  try {
    const expectedAmountRaw = usdcToRaw(post.price_usdc || 0);

    const verifiedPayment = await verifySolanaPayment({
      signature: proof.transaction_signature,
      expectedPostId: post.id,
      expectedAmountRaw,
      requestTimestamp: proof.timestamp,
      memoExpirationSeconds: X402_CONFIG.PAYMENT_VALIDITY_SECONDS,
    });

    // Cache the verified payment
    await cacheVerifiedPayment('solana', proof.transaction_signature);

    return {
      success: true,
      payment: {
        signature: verifiedPayment.signature,
        payer: verifiedPayment.payer,
        recipient: verifiedPayment.recipient,
        amount_raw: verifiedPayment.amount,
        amount_usdc: rawToUsdc(verifiedPayment.amount),
        network: 'solana',
        chain_id: 'mainnet-beta',
      },
    };
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return {
        success: false,
        error: error.message,
        error_code: error.code,
      };
    }

    console.error('Unexpected error verifying Solana payment:', error);
    return {
      success: false,
      error: 'Unexpected verification error',
      error_code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Verify a Base (EVM) payment proof.
 * Placeholder for Phase 3 implementation.
 */
async function verifyBasePaymentProof(
  proof: PaymentProof,
  post: PostForPayment
): Promise<VerificationResult> {
  // Phase 3: Implement Base/EVM verification
  return {
    success: false,
    error: 'Base payment verification not yet implemented',
    error_code: 'NOT_IMPLEMENTED',
  };
}

// ============================================
// 2.3.9: Record Payment Event on Success
// ============================================

/**
 * Platform fee in basis points (500 = 5%)
 */
const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '500', 10);

/**
 * Calculate platform fee from gross amount.
 */
export function calculatePlatformFee(grossAmountRaw: bigint): bigint {
  return (grossAmountRaw * BigInt(PLATFORM_FEE_BPS)) / BigInt(10000);
}

/**
 * Calculate author amount after platform fee.
 */
export function calculateAuthorAmount(grossAmountRaw: bigint): bigint {
  return grossAmountRaw - calculatePlatformFee(grossAmountRaw);
}

/**
 * Record a verified payment event in the database.
 * Calculates 95/5 split between author and platform.
 *
 * @param proof - The payment proof
 * @param post - The post that was paid for
 * @param verificationResult - The verification result with payment details
 * @returns The inserted payment event ID or null on error
 */
export async function recordPaymentEvent(
  proof: PaymentProof,
  post: PostForPayment,
  verificationResult: VerificationResult
): Promise<string | null> {
  if (!verificationResult.success || !verificationResult.payment) {
    console.error('Cannot record failed payment');
    return null;
  }

  const payment = verificationResult.payment;
  const grossAmountRaw = payment.amount_raw;
  const platformFeeRaw = calculatePlatformFee(grossAmountRaw);
  const authorAmountRaw = calculateAuthorAmount(grossAmountRaw);

  // Get recipient address based on network
  const recipientAddress =
    payment.network === 'solana'
      ? post.author.wallet_solana
      : post.author.wallet_base;

  if (!recipientAddress) {
    console.error(
      `Author ${post.author_id} has no wallet for ${payment.network}`
    );
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('payment_events')
      .insert({
        resource_type: 'post' as const,
        resource_id: post.id,
        network: payment.network,
        chain_id: payment.chain_id,
        transaction_signature: payment.signature,
        payer_address: payment.payer,
        recipient_id: post.author_id,
        recipient_address: recipientAddress,
        gross_amount_raw: Number(grossAmountRaw),
        platform_fee_raw: Number(platformFeeRaw),
        author_amount_raw: Number(authorAmountRaw),
        status: 'confirmed' as const,
        verified_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      // Check for unique constraint violation (double-spend attempt)
      if (error.code === '23505') {
        console.warn(
          `Payment already recorded: ${payment.network}:${payment.signature}`
        );
        // Not an error - payment was already processed
        return 'already_recorded';
      }

      console.error('Failed to record payment event:', error);
      return null;
    }

    console.log(
      `Payment recorded: ${data.id} - ${rawToUsdc(grossAmountRaw)} USDC (author: ${rawToUsdc(authorAmountRaw)}, platform: ${rawToUsdc(platformFeeRaw)})`
    );

    return data.id;
  } catch (error) {
    console.error('Unexpected error recording payment:', error);
    return null;
  }
}

/**
 * Increment paid view count for a post.
 * Uses a simple update - for high-traffic, consider using a database function.
 */
export async function incrementPaidViewCount(
  postId: string,
  currentCount: number
): Promise<void> {
  try {
    await supabaseAdmin
      .from('posts')
      .update({ paid_view_count: currentCount + 1 })
      .eq('id', postId);
  } catch (error) {
    console.error('Failed to increment paid view count:', error);
  }
}
