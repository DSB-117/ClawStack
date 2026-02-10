/**
 * x402 Payment Verification Module
 *
 * Handles parsing of X-Payment-Proof headers and routing to
 * the Base (EVM) verifier.
 */

import {
  PaymentProof,
  VerificationResult,
  PostForPayment,
  X402_CONFIG,
} from './types';
import { usdcToRaw, rawToUsdc } from './helpers';
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
// Parse X-Payment-Proof Header
// ============================================

/**
 * Parse the X-Payment-Proof header from a request.
 * Expected format: JSON with chain, transaction_signature, payer_address, timestamp
 */
export function parsePaymentProof(header: string | null): PaymentProof | null {
  if (!header) {
    return null;
  }

  try {
    const proof = JSON.parse(header);

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

    // Only support Base
    if (proof.chain !== 'base') {
      console.warn(`Unsupported payment chain: ${proof.chain}`);
      return null;
    }

    // EVM tx hashes are 66 chars (0x + 64 hex)
    if (!isValidTransactionHash(proof.transaction_signature)) {
      console.warn('Invalid EVM transaction hash format');
      return null;
    }

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
// Payment Proof Caching
// ============================================

const CACHE_TTL_SECONDS = 3600;

function getPaymentCacheKey(network: string, signature: string): string {
  return `payment:verified:${network}:${signature}`;
}

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
// Verify Payment (Base only)
// ============================================

/**
 * Verify a payment proof by routing to the Base EVM verifier.
 */
export async function verifyPayment(
  proof: PaymentProof,
  post: PostForPayment
): Promise<VerificationResult> {
  // Check for double-spend
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

  // Check cache
  const isCached = await checkPaymentCache(proof.chain, proof.transaction_signature);
  if (isCached) {
    return {
      success: true,
      payment: {
        signature: proof.transaction_signature,
        payer: proof.payer_address,
        recipient: process.env.BASE_TREASURY_ADDRESS || '',
        amount_raw: usdcToRaw(post.price_usdc || 0),
        amount_usdc: (post.price_usdc || 0).toFixed(2),
        network: 'base',
        chain_id: '8453',
      },
    };
  }

  // Verify on Base
  return verifyBasePaymentProof(proof, post);
}

/**
 * Verify a Base (EVM) payment proof.
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
// Record Payment Event & Grant Access
// ============================================

/**
 * Platform fee in basis points (1000 = 10%)
 */
const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '1000', 10);

export function calculatePlatformFee(grossAmountRaw: bigint): bigint {
  return (grossAmountRaw * BigInt(PLATFORM_FEE_BPS)) / BigInt(10000);
}

export function calculateAuthorAmount(grossAmountRaw: bigint): bigint {
  return grossAmountRaw - calculatePlatformFee(grossAmountRaw);
}

/**
 * Record a verified payment event in the database and grant permanent access.
 * Calculates 90/10 split between author and platform.
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

  const recipientAddress = post.author.wallet_base;

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
      if (error.code === '23505') {
        console.warn(
          `Payment already recorded: ${payment.network}:${payment.signature}`
        );
        // Still grant access even if payment was already recorded
        await grantArticleAccess(post.id, payment.payer, 'already_recorded', payment.signature, payment.network);
        return 'already_recorded';
      }

      console.error('Failed to record payment event:', error);
      return null;
    }

    console.log(
      `Payment recorded: ${data.id} - ${rawToUsdc(grossAmountRaw)} USDC (author: ${rawToUsdc(authorAmountRaw)}, platform: ${rawToUsdc(platformFeeRaw)})`
    );

    // Grant permanent article access
    await grantArticleAccess(post.id, payment.payer, data.id, payment.signature, payment.network);

    // Fire-and-forget: distribute split funds
    void triggerSplitDistribution(post.author_id);

    return data.id;
  } catch (error) {
    console.error('Unexpected error recording payment:', error);
    return null;
  }
}

/**
 * Grant permanent access to an article for a payer.
 */
async function grantArticleAccess(
  postId: string,
  payerAddress: string,
  paymentEventId: string,
  transactionSignature: string,
  network: string
): Promise<void> {
  try {
    await supabaseAdmin
      .from('article_access')
      .upsert(
        {
          post_id: postId,
          payer_address: payerAddress.toLowerCase(),
          payment_event_id: paymentEventId === 'already_recorded' ? null : paymentEventId,
          transaction_signature: transactionSignature,
          network,
        },
        { onConflict: 'post_id,payer_address' }
      );

    console.log(`Access granted: ${payerAddress} → post ${postId}`);
  } catch (error) {
    console.error('Failed to grant article access:', error);
  }
}

/**
 * Fire-and-forget: trigger 0xSplits distribution for an author's split contract.
 */
async function triggerSplitDistribution(authorId: string): Promise<void> {
  try {
    const { distributeSplitForAuthor } = await import('@/lib/splits');
    await distributeSplitForAuthor(authorId);
  } catch (error) {
    // Non-fatal: funds sit in split contract until next distribution
    console.error('Failed to distribute split:', error);
  }
}

/**
 * Increment paid view count for a post.
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
// Spam Fee Payment Verification (Base only)
// ============================================

/**
 * Verify a spam fee payment proof.
 */
export async function verifySpamFeePayment(
  proof: PaymentProof,
  agentId: string,
  expectedFeeUsdc: string
): Promise<VerificationResult> {
  const isCached = await checkPaymentCache(proof.chain, proof.transaction_signature);
  if (isCached) {
    return {
      success: true,
      payment: {
        signature: proof.transaction_signature,
        payer: proof.payer_address,
        recipient: process.env.BASE_TREASURY_ADDRESS || '',
        amount_raw: usdcToRaw(parseFloat(expectedFeeUsdc)),
        amount_usdc: expectedFeeUsdc,
        network: 'base',
        chain_id: '8453',
      },
    };
  }

  return verifyBaseSpamFeePayment(proof, agentId, expectedFeeUsdc);
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

    const verifiedPayment = await verifyEVMPayment({
      transactionHash: proof.transaction_signature as `0x${string}`,
      expectedPostId: `spam_fee:${agentId}`,
      expectedAmountRaw,
      requestTimestamp: proof.timestamp,
      referenceExpirationSeconds: X402_CONFIG.PAYMENT_VALIDITY_SECONDS,
    });

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
  const platformFeeRaw = grossAmountRaw;
  const authorAmountRaw = BigInt(0);

  try {
    const { data, error } = await supabaseAdmin
      .from('payment_events')
      .insert({
        resource_type: 'spam_fee' as const,
        resource_id: agentId,
        network: payment.network,
        chain_id: payment.chain_id,
        transaction_signature: payment.signature,
        payer_address: payment.payer,
        recipient_id: null,
        recipient_address: payment.recipient,
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
