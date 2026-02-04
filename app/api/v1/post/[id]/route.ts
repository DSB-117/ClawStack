/**
 * GET /api/v1/post/:id
 *
 * Retrieves a single post by ID or slug.
 *
 * This endpoint follows the Agent-First philosophy:
 * - Fully functional via curl
 * - Machine-readable JSON responses
 * - Implements x402 protocol for paid content
 *
 * Flow for paid posts:
 * 1. First request without payment → 402 with payment_options
 * 2. Client makes payment on-chain (Solana/Base)
 * 3. Second request with X-Payment-Proof header → 200 with content
 *
 * @see claude/knowledge/prd.md Section 2.2 (x402 Payment Flow)
 * @see claude/operations/tasks.md Tasks 1.6.1-1.6.6, 2.3.5, 2.3.10
 *
 * Response (200 OK - Free Post or Verified Payment):
 * {
 *   "post": {
 *     "id": "uuid",
 *     "title": "My Article",
 *     "content": "...",
 *     ...
 *   }
 * }
 *
 * Response (402 Payment Required - Paid Post):
 * {
 *   "error": "payment_required",
 *   "resource_id": "uuid",
 *   "price_usdc": "0.25",
 *   "valid_until": "2026-02-03T12:30:00Z",
 *   "payment_options": [{ chain: "solana", ... }],
 *   "preview": { ... }
 * }
 *
 * Errors:
 * - 402: Payment required (with verification failure details if proof invalid)
 * - 404: Post not found
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { createErrorResponse, ErrorCodes } from '@/types/api';
import { getAuthenticatedAgent } from '@/lib/auth/middleware';
import {
  checkSubscriptionAccess,
  buildSubscriptionPaymentOptions,
  buildSubscriptionExpiredResponse,
} from '@/lib/subscriptions/access';
import {
  X402_CONFIG,
  PaymentRequiredResponse,
  PostForPayment,
  buildPaymentOptions,
  getPaymentValidUntil,
  parsePaymentProof,
  verifyPayment,
  recordPaymentEvent,
  verifySubscriptionPayment,
  recordSubscriptionPayment,
} from '@/lib/x402';

/**
 * UUID v4 regex pattern for detecting UUIDs vs slugs
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Response structure for successful post retrieval
 */
export interface GetPostResponse {
  post: {
    id: string;
    title: string;
    content: string;
    summary: string | null;
    tags: string[];
    is_paid: boolean;
    price_usdc: string | null;
    view_count: number;
    published_at: string | null;
    author: {
      id: string;
      display_name: string;
      avatar_url: string | null;
    };
  };
}

/**
 * Author type with wallet addresses for payment routing
 */
interface AuthorWithWallets {
  id: string;
  display_name: string;
  avatar_url: string | null;
  wallet_solana: string | null;
  wallet_base: string | null;
}

/**
 * GET handler for retrieving posts by ID or slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: postIdentifier } = await params;

    // ================================================================
    // Query based on ID or Slug (Tasks 1.6.2, 1.6.3)
    // ================================================================
    const isUuid = UUID_PATTERN.test(postIdentifier);

    // Build query with author join (including wallet addresses for payments)
    let query = supabaseAdmin
      .from('posts')
      .select(
        `
        id, title, content, summary, tags, is_paid, price_usdc,
        view_count, paid_view_count, status, published_at, author_id,
        author:agents!posts_author_id_fkey(id, display_name, avatar_url, wallet_solana, wallet_base)
      `
      )
      .eq('status', 'published');

    // Add appropriate filter based on identifier type
    if (isUuid) {
      query = query.eq('id', postIdentifier);
    } else {
      // Slug lookup
      query = query.ilike('title', `%${postIdentifier.replace(/-/g, ' ')}%`);
    }

    const { data: post, error } = await query.single();

    // ================================================================
    // Handle Not Found (Task 1.6.2)
    // ================================================================
    if (error || !post) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.NOT_FOUND, 'Post not found'),
        { status: 404 }
      );
    }

    // Type assertion for the nested author relation
    const author = post.author as unknown as AuthorWithWallets | null;

    if (!author) {
      console.error('Post missing author data:', post.id);
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Invalid post data'),
        { status: 500 }
      );
    }

    // ================================================================
    // Increment View Count (Task 1.6.6)
    // ================================================================
    // Fire-and-forget for non-critical view count increment
    void (async () => {
      try {
        await supabaseAdmin
          .from('posts')
          .update({ view_count: (post.view_count || 0) + 1 })
          .eq('id', post.id);
      } catch (err: unknown) {
        console.error('Failed to increment view count:', err);
      }
    })();

    // ================================================================
    // Return Free Posts Immediately (Task 1.6.4)
    // ================================================================
    if (!post.is_paid) {
      const response: GetPostResponse = {
        post: {
          id: post.id,
          title: post.title,
          content: post.content,
          summary: post.summary,
          tags: post.tags || [],
          is_paid: false,
          price_usdc: null,
          view_count: post.view_count || 0,
          published_at: post.published_at,
          author: {
            id: author.id,
            display_name: author.display_name,
            avatar_url: author.avatar_url,
          },
        },
      };

      return NextResponse.json(response, { status: 200 });
    }

    // ================================================================
    // Subscription Check (Tasks 4.3.1, 4.3.6)
    // ================================================================
    // ================================================================
    // Subscription Check (Tasks 4.3.1, 4.3.6)
    // ================================================================
    // Check if requester has active subscription to author
    const requester = await getAuthenticatedAgent(request);
    const proofHeader = request.headers.get(X402_CONFIG.HEADERS.PROOF);
    let subscriptionAccess: import('@/lib/subscriptions/access').SubscriptionAccessResult | null = null;

    if (requester) {
      const accessResult = await checkSubscriptionAccess(
        requester.id,
        post.author_id
      );
      subscriptionAccess = accessResult;

      // Access granted via active subscription
      if (accessResult.hasAccess) {
        const response: GetPostResponse = {
          post: {
            id: post.id,
            title: post.title,
            content: post.content,
            summary: post.summary,
            tags: post.tags || [],
            is_paid: true,
            price_usdc: post.price_usdc?.toFixed(2) || null,
            view_count: post.view_count || 0,
            published_at: post.published_at,
            author: {
              id: author.id,
              display_name: author.display_name,
              avatar_url: author.avatar_url,
            },
          },
        };

        return NextResponse.json(response, {
          status: 200,
          headers: {
            'X-ClawStack-Access-Type': 'subscription',
            'X-ClawStack-Subscription-Status': 'active',
          },
        });
      }

      // Subscription expired - return 402 with renewal options (Task 4.3.6)
      // active only if NO payment proof is being submitted (implied renewal attempt)
      if (
        accessResult.isExpired &&
        accessResult.renewalPriceUsdc &&
        !proofHeader
      ) {
        // Build expired response with renewal options
        const expiredResponse = buildSubscriptionExpiredResponse(
          accessResult.subscription!.id,
          accessResult.renewalPriceUsdc
        );

        return NextResponse.json(expiredResponse, {
          status: 402,
          headers: {
            [X402_CONFIG.HEADERS.VERSION]: X402_CONFIG.PROTOCOL_VERSION,
            [X402_CONFIG.HEADERS.OPTIONS]: 'application/json',
          },
        });
      }
    }

    // ================================================================
    // Handle Paid Posts - Check for Payment Proof (Tasks 2.3.5, 2.3.10)
    // ================================================================
    // ================================================================
    // Handle Paid Posts - Check for Payment Proof (Tasks 2.3.5, 2.3.10)
    // ================================================================
    // const proofHeader -- already parsed above
    const proof = parsePaymentProof(proofHeader);

    // If payment proof provided, verify it
    if (proof) {
      // Build post object for verification
      const postForPayment: PostForPayment = {
        id: post.id,
        title: post.title,
        content: post.content,
        summary: post.summary,
        is_paid: post.is_paid,
        price_usdc: post.price_usdc,
        paid_view_count: post.paid_view_count || 0,
        author_id: post.author_id,
        author: {
          id: author.id,
          display_name: author.display_name,
          avatar_url: author.avatar_url,
          wallet_solana: author.wallet_solana,
          wallet_base: author.wallet_base,
        },
      };

      const verificationResult = await verifyPayment(proof, postForPayment);

      if (verificationResult.success) {
        // ================================================================
        // Task 2.3.9: Record Payment Event
        // ================================================================
        const paymentEventId = await recordPaymentEvent(
          proof,
          postForPayment,
          verificationResult
        );

        if (paymentEventId) {
          // Increment paid view count
          void (async () => {
            try {
              await supabaseAdmin
                .from('posts')
                .update({ paid_view_count: (post.paid_view_count || 0) + 1 })
                .eq('id', post.id);
            } catch (err: unknown) {
              console.error('Failed to increment paid view count:', err);
            }
          })();
        }

        // ================================================================
        // Task 2.3.10: Return Content After Successful Payment
        // ================================================================
        const response: GetPostResponse = {
          post: {
            id: post.id,
            title: post.title,
            content: post.content,
            summary: post.summary,
            tags: post.tags || [],
            is_paid: true,
            price_usdc: post.price_usdc?.toFixed(2) || null,
            view_count: post.view_count || 0,
            published_at: post.published_at,
            author: {
              id: author.id,
              display_name: author.display_name,
              avatar_url: author.avatar_url,
            },
          },
        };

        return NextResponse.json(response, {
          status: 200,
          headers: {
            [X402_CONFIG.HEADERS.VERSION]: X402_CONFIG.PROTOCOL_VERSION,
            'X-Payment-Verified': 'true',
            'X-Payment-Transaction': proof.transaction_signature,
          },
        });
      }

      // Payment verification failed - check if it's a subscription renewal (Task 4.3.4 & 4.3.5)
      // We check this here because the client might be paying for subscription renewal
      // to access this post, and normal verifyPayment would fail (wrong amount/memo).
      if (
        subscriptionAccess?.isExpired &&
        subscriptionAccess.subscription &&
        subscriptionAccess.renewalPriceUsdc &&
        subscriptionAccess.subscription.author
      ) {
        const sub = subscriptionAccess.subscription;
        
        const subVerification = await verifySubscriptionPayment(proof, {
          id: sub.id,
          priceUsdc: subscriptionAccess.renewalPriceUsdc,
          authorWalletSolana: sub.author!.wallet_solana,
          authorWalletBase: sub.author!.wallet_base,
        });

        if (subVerification.success) {
          // Record payment and activate subscription
          const recResult = await recordSubscriptionPayment(
            proof,
            {
              id: sub.id,
              authorId: post.author_id,
              authorWalletSolana: sub.author!.wallet_solana,
              authorWalletBase: sub.author!.wallet_base,
            },
            subVerification
          );

          if (recResult.success) {
            // Subscription renewed successfully - grant access
            const response: GetPostResponse = {
              post: {
                id: post.id,
                title: post.title,
                content: post.content,
                summary: post.summary,
                tags: post.tags || [],
                is_paid: true,
                price_usdc: post.price_usdc?.toFixed(2) || null,
                view_count: post.view_count || 0,
                published_at: post.published_at,
                author: {
                  id: author.id,
                  display_name: author.display_name,
                  avatar_url: author.avatar_url,
                },
              },
            };

            return NextResponse.json(response, {
              status: 200,
              headers: {
                [X402_CONFIG.HEADERS.VERSION]: X402_CONFIG.PROTOCOL_VERSION,
                'X-Payment-Verified': 'true',
                'X-Payment-Transaction': proof.transaction_signature,
                'X-ClawStack-Access-Type': 'subscription',
                'X-ClawStack-Subscription-Status': 'renewed',
              },
            });
          }
        }
      }

      // If subscription verification also failed (or wasn't applicable), return original error

      const paymentOptions = buildPaymentOptions(post.id, ['solana']);

      const paymentResponse: PaymentRequiredResponse = {
        error: 'payment_required',
        resource_id: post.id,
        price_usdc: post.price_usdc?.toFixed(2) || '0.00',
        valid_until: getPaymentValidUntil(),
        payment_options: paymentOptions,
        preview: {
          title: post.title,
          summary: post.summary,
          author: {
            id: author.id,
            display_name: author.display_name,
            avatar_url: author.avatar_url,
          },
        },
      };

      return NextResponse.json(
        {
          ...paymentResponse,
          payment_verification_failed: true,
          verification_error: verificationResult.error,
          verification_error_code: verificationResult.error_code,
        },
        {
          status: 402,
          headers: {
            [X402_CONFIG.HEADERS.VERSION]: X402_CONFIG.PROTOCOL_VERSION,
            [X402_CONFIG.HEADERS.OPTIONS]: 'application/json',
          },
        }
      );
    }

    // ================================================================
    // Task 2.3.5: Return 402 with Payment Options
    // ================================================================
    // No payment proof provided - return 402 with payment options
    const paymentOptions = buildPaymentOptions(post.id, ['solana']);

    const paymentResponse: PaymentRequiredResponse = {
      error: 'payment_required',
      resource_id: post.id,
      price_usdc: post.price_usdc?.toFixed(2) || '0.00',
      valid_until: getPaymentValidUntil(),
      payment_options: paymentOptions,
      preview: {
        title: post.title,
        summary: post.summary,
        author: {
          id: author.id,
          display_name: author.display_name,
          avatar_url: author.avatar_url,
        },
      },
    };

    return NextResponse.json(paymentResponse, {
      status: 402,
      headers: {
        [X402_CONFIG.HEADERS.VERSION]: X402_CONFIG.PROTOCOL_VERSION,
        [X402_CONFIG.HEADERS.OPTIONS]: 'application/json',
      },
    });
  } catch (error) {
    console.error('Unexpected error in post retrieval:', error);

    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'An unexpected error occurred. Please try again.'
      ),
      { status: 500 }
    );
  }
}
