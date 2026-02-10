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
import {
  verifyEVMPayment,
  EVMPaymentVerificationError,
  isValidTransactionHash,
} from '@/lib/evm/verify';
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

    // Validate transaction signature format based on chain
    if (proof.chain === 'base') {
      // EVM tx hashes are 66 chars (0x + 64 hex)
      if (!isValidTransactionHash(proof.transaction_signature)) {
        console.warn('Invalid EVM transaction hash format');
        return null;
      }
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
  // Check for double-spend: verify transaction hasn't been used before
  const { data: existingPayment } = await supabaseAdmin
    .from('payment_events')
    .select('id, resource_type, resource_id')
    .eq('network', proof.chain)
    .eq('transaction_signature', proof.transaction_signature)
    .single();

  if (existingPayment) {
    console.warn(
      `Double-spend attempt detected: ${proof.chain}:${proof.transaction_signature} already used for ${existingPayment.resource_type}:${existingPayment.resource_id}`
    );
    return {
      success: false,
      error: 'Transaction already used for payment',
      error_code: 'TRANSACTION_ALREADY_USED',
    };
  }

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
 * Routes to the EVM verifier for USDC transfer validation.
 */
async function verifyBasePaymentProof(
  proof: PaymentProof,
  post: PostForPayment
): Promise<VerificationResult> {
  try {
    const expectedAmountRaw = usdcToRaw(post.price_usdc || 0);

    const verifiedPayment = await verifyEVMPayment({
      transactionHash: proof.transaction_signature as `0x${string}`,
      expectedPostId: post.id,
      expectedAmountRaw,
      requestTimestamp: proof.timestamp,
      referenceExpirationSeconds: X402_CONFIG.PAYMENT_VALIDITY_SECONDS,
    });

    // Cache the verified payment
    await cacheVerifiedPayment('base', proof.transaction_signature);

    return {
      success: true,
      payment: {
        signature: verifiedPayment.transactionHash,
        payer: verifiedPayment.payer,
        recipient: verifiedPayment.recipient,
        amount_raw: verifiedPayment.amount,
        amount_usdc: rawToUsdc(verifiedPayment.amount),
        network: 'base',
        chain_id: '8453',
      },
    };
  } catch (error) {
    if (error instanceof EVMPaymentVerificationError) {
      return {
        success: false,
        error: error.message,
        error_code: error.code,
      };
    }

    console.error('Unexpected error verifying Base payment:', error);
    return {
      success: false,
      error: 'Unexpected verification error',
      error_code: 'INTERNAL_ERROR',
    };
  }
}

// ============================================
// 2.3.9: Record Payment Event on Success
// ============================================

/**
 * Platform fee in basis points (500 = 5%)
 */
const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '1000', 10);

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

// ============================================
// 2.5.2: Spam Fee Payment Verification
// ============================================

/**
 * Verify a spam fee payment proof.
 * Similar to content payment verification but for anti-spam fees.
 *
 * @param proof - The payment proof
 * @param agentId - The agent ID paying the spam fee
 * @param expectedFeeUsdc - Expected spam fee amount in USDC
 * @returns Verification result
 *
 * @see claude/operations/tasks.md Task 2.5.2
 */
export async function verifySpamFeePayment(
  proof: PaymentProof,
  agentId: string,
  expectedFeeUsdc: string
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
        amount_raw: usdcToRaw(parseFloat(expectedFeeUsdc)),
        amount_usdc: expectedFeeUsdc,
        network: proof.chain,
        chain_id: proof.chain === 'solana' ? 'mainnet-beta' : '8453',
      },
    };
  }

  // Route to appropriate verifier
  switch (proof.chain) {
    case 'solana':
      return verifySolanaSpamFeePayment(proof, agentId, expectedFeeUsdc);
    case 'base':
      return verifyBaseSpamFeePayment(proof, agentId, expectedFeeUsdc);
    default:
      return {
        success: false,
        error: `Unsupported payment chain: ${proof.chain}`,
        error_code: 'UNSUPPORTED_CHAIN',
      };
  }
}

/**
 * Verify a Solana spam fee payment.
 */
async function verifySolanaSpamFeePayment(
  proof: PaymentProof,
  agentId: string,
  expectedFeeUsdc: string
): Promise<VerificationResult> {
  try {
    const expectedAmountRaw = usdcToRaw(parseFloat(expectedFeeUsdc));

    // Verify the payment with spam_fee memo
    const verifiedPayment = await verifySolanaPayment({
      signature: proof.transaction_signature,
      expectedPostId: `spam_fee:${agentId}`,
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

    console.error('Unexpected error verifying Solana spam fee payment:', error);
    return {
      success: false,
      error: 'Unexpected verification error',
      error_code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Verify a Base (EVM) spam fee payment.
 */
async function verifyBaseSpamFeePayment(
  proof: PaymentProof,
  agentId: string,
  expectedFeeUsdc: string
): Promise<VerificationResult> {
  try {
    const expectedAmountRaw = usdcToRaw(parseFloat(expectedFeeUsdc));

    // Verify the payment - for spam fees we use a special reference format
    const verifiedPayment = await verifyEVMPayment({
      transactionHash: proof.transaction_signature as `0x${string}`,
      expectedPostId: `spam_fee:${agentId}`,
      expectedAmountRaw,
      requestTimestamp: proof.timestamp,
      referenceExpirationSeconds: X402_CONFIG.PAYMENT_VALIDITY_SECONDS,
    });

    // Cache the verified payment
    await cacheVerifiedPayment('base', proof.transaction_signature);

    return {
      success: true,
      payment: {
        signature: verifiedPayment.transactionHash,
        payer: verifiedPayment.payer,
        recipient: verifiedPayment.recipient,
        amount_raw: verifiedPayment.amount,
        amount_usdc: rawToUsdc(verifiedPayment.amount),
        network: 'base',
        chain_id: '8453',
      },
    };
  } catch (error) {
    if (error instanceof EVMPaymentVerificationError) {
      return {
        success: false,
        error: error.message,
        error_code: error.code,
      };
    }

    console.error('Unexpected error verifying Base spam fee payment:', error);
    return {
      success: false,
      error: 'Unexpected verification error',
      error_code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Record a spam fee payment event in the database.
 * Spam fees go 100% to platform treasury (no author split).
 *
 * @param proof - The payment proof
 * @param agentId - The agent ID paying the spam fee
 * @param verificationResult - The verification result with payment details
 * @returns The inserted payment event ID or null on error
 *
 * @see claude/operations/tasks.md Task 2.5.4
 */
export async function recordSpamFeePayment(
  proof: PaymentProof,
  agentId: string,
  verificationResult: VerificationResult
): Promise<string | null> {
  if (!verificationResult.success || !verificationResult.payment) {
    console.error('Cannot record failed spam fee payment');
    return null;
  }

  const payment = verificationResult.payment;
  const grossAmountRaw = payment.amount_raw;

  // Spam fees go 100% to platform (no author split)
  const platformFeeRaw = grossAmountRaw;
  const authorAmountRaw = BigInt(0);

  try {
    const { data, error } = await supabaseAdmin
      .from('payment_events')
      .insert({
        resource_type: 'spam_fee' as const,
        resource_id: agentId, // Agent paying the fee
        network: payment.network,
        chain_id: payment.chain_id,
        transaction_signature: payment.signature,
        payer_address: payment.payer,
        recipient_id: null, // No author recipient for spam fees
        recipient_address: payment.recipient, // Platform treasury
        gross_amount_raw: Number(grossAmountRaw),
        platform_fee_raw: Number(platformFeeRaw),
        author_amount_raw: Number(authorAmountRaw),
        status: 'confirmed' as const,
        verified_at: new Date().toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select('id')
      .single();

    if (error) {
      // Check for unique constraint violation (double-spend attempt)
      if (error.code === '23505') {
        console.warn(
          `Spam fee payment already recorded: ${payment.network}:${payment.signature}`
        );
        return 'already_recorded';
      }

      console.error('Failed to record spam fee payment:', error);
      return null;
    }

    console.log(
      `Spam fee recorded: ${data.id} - ${rawToUsdc(grossAmountRaw)} USDC (100% platform)`
    );

    return data.id;
  } catch (error) {
    console.error('Unexpected error recording spam fee payment:', error);
    return null;
  }
}
