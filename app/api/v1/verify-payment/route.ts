/**
 * Internal Payment Verification Endpoint
 *
 * POST /api/v1/verify-payment
 *
 * This endpoint provides a unified interface for verifying payments across
 * both Solana and Base chains. It's intended for internal/admin use only.
 *
 * @see claude/operations/tasks.md Task 3.5.1
 * @see claude/knowledge/prd.md Section 2.2 (x402 Payment Flow)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import {
  verifyPayment,
  type PaymentProof,
  type PostForPayment,
} from '@/lib/x402';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { createErrorResponse, formatZodErrors } from '@/types/api';

// ============================================
// Request Validation Schema
// ============================================

const verifyPaymentSchema = z.object({
  chain: z.enum(['solana', 'base']),
  transaction_signature: z.string().min(1),
  payer_address: z.string().min(1),
  resource_type: z.enum(['post', 'spam_fee']),
  resource_id: z.string().uuid(),
  timestamp: z.number().optional(),
});

// type VerifyPaymentRequest = z.infer<typeof verifyPaymentSchema>;

// ============================================
// Admin Authentication
// ============================================

/**
 * Verify admin/internal authentication.
 * Checks for a valid admin token in the Authorization header.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyAdminAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);

  // Check against admin token from environment
  const adminToken = process.env.ADMIN_API_TOKEN;

  if (!adminToken) {
    console.warn('ADMIN_API_TOKEN not configured');
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  // If lengths differ, we still do a comparison to avoid leaking length info
  const tokenBuffer = Buffer.from(token);
  const adminBuffer = Buffer.from(adminToken);

  // Constant-time length check + comparison
  if (tokenBuffer.length !== adminBuffer.length) {
    // Compare against itself to maintain constant time, then return false
    timingSafeEqual(adminBuffer, adminBuffer);
    return false;
  }

  return timingSafeEqual(tokenBuffer, adminBuffer);
}

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // 1. Verify admin authentication
    if (!verifyAdminAuth(request)) {
      return NextResponse.json(
        createErrorResponse('unauthorized', 'Invalid or missing admin token'),
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const validation = verifyPaymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        formatZodErrors(validation.error),
        { status: 400 }
      );
    }

    const {
      chain,
      transaction_signature,
      payer_address,
      resource_type,
      resource_id,
      timestamp,
    } = validation.data;

    // 3. Currently only support 'post' resource type
    if (resource_type !== 'post') {
      return NextResponse.json(
        createErrorResponse(
          'not_implemented',
          `Resource type '${resource_type}' verification not yet implemented`
        ),
        { status: 501 }
      );
    }

    // 4. Fetch the post/resource
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select(
        `
        id,
        title,
        content,
        summary,
        is_paid,
        price_usdc,
        paid_view_count,
        author_id,
        author:agents!posts_author_id_fkey (
          id,
          display_name,
          avatar_url,
          wallet_solana,
          wallet_base
        )
      `
      )
      .eq('id', resource_id)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        createErrorResponse('resource_not_found', 'Post not found'),
        { status: 404 }
      );
    }

    // 5. Construct payment proof
    const proof: PaymentProof = {
      chain,
      transaction_signature,
      payer_address,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
    };

    // 6. Verify payment using unified verifier
    const postForPayment: PostForPayment = {
      id: post.id,
      title: post.title,
      content: post.content,
      summary: post.summary,
      is_paid: post.is_paid,
      price_usdc: post.price_usdc,
      paid_view_count: post.paid_view_count,
      author_id: post.author_id,
      author: Array.isArray(post.author) ? post.author[0] : post.author,
    };

    const verificationResult = await verifyPayment(proof, postForPayment);

    // 7. Log verification metrics
    const latencyMs = Date.now() - startTime;
    console.log(
      JSON.stringify({
        event: 'payment_verification',
        chain: proof.chain,
        tx: proof.transaction_signature,
        resource_type,
        resource_id,
        success: verificationResult.success,
        latency_ms: latencyMs,
        timestamp: new Date().toISOString(),
      })
    );

    // 8. Return standardized response
    if (verificationResult.success && verificationResult.payment) {
      return NextResponse.json(
        {
          success: true,
          payment_id: verificationResult.payment.signature,
          amount_usdc: verificationResult.payment.amount_usdc,
          platform_fee_usdc: calculatePlatformFeeUsdc(
            verificationResult.payment.amount_raw
          ),
          author_amount_usdc: calculateAuthorAmountUsdc(
            verificationResult.payment.amount_raw
          ),
          chain: verificationResult.payment.network,
          chain_id: verificationResult.payment.chain_id,
          payer: verificationResult.payment.payer,
          recipient: verificationResult.payment.recipient,
          timestamp: new Date().toISOString(),
          latency_ms: latencyMs,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: verificationResult.error || 'Verification failed',
          error_code: verificationResult.error_code || 'VERIFICATION_FAILED',
          chain,
          transaction_signature,
          latency_ms: latencyMs,
        },
        { status: 402 }
      );
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('Unexpected error in verify-payment endpoint:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        error_code: 'INTERNAL_ERROR',
        latency_ms: latencyMs,
      },
      { status: 500 }
    );
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate platform fee in USDC from raw amount.
 */
function calculatePlatformFeeUsdc(amountRaw: bigint): string {
  const platformFeeBps = parseInt(process.env.PLATFORM_FEE_BPS || '1000', 10);
  const feeRaw = (amountRaw * BigInt(platformFeeBps)) / BigInt(10000);
  return (Number(feeRaw) / 1_000_000).toFixed(2);
}

/**
 * Calculate author amount in USDC from raw amount.
 */
function calculateAuthorAmountUsdc(amountRaw: bigint): string {
  const platformFeeBps = parseInt(process.env.PLATFORM_FEE_BPS || '1000', 10);
  const feeRaw = (amountRaw * BigInt(platformFeeBps)) / BigInt(10000);
  const authorRaw = amountRaw - feeRaw;
  return (Number(authorRaw) / 1_000_000).toFixed(2);
}
