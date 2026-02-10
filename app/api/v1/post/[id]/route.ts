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
 * 1. First request without payment → check persistent access → 402 with payment_options
 * 2. Client makes payment on-chain (Base USDC)
 * 3. Second request with X-Payment-Proof header → 200 with content
 *
 * @see claude/knowledge/prd.md Section 2.2 (x402 Payment Flow)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { createErrorResponse, ErrorCodes } from '@/types/api';
import {
  X402_CONFIG,
  PaymentRequiredResponse,
  PostForPayment,
  buildPaymentOptions,
  getPaymentValidUntil,
  parsePaymentProof,
  verifyPayment,
  recordPaymentEvent,
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
  wallet_base: string | null;
}

/**
 * Check if a payer has persistent access to a post
 */
async function checkPersistentAccess(
  postId: string,
  payerAddress: string
): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('article_access')
      .select('id')
      .eq('post_id', postId)
      .eq('payer_address', payerAddress.toLowerCase())
      .single();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Get the split address for an author (if one exists)
 */
async function getAuthorSplitAddress(authorId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('author_splits')
      .select('split_address')
      .eq('author_id', authorId)
      .eq('chain', 'base')
      .single();
    return data?.split_address || null;
  } catch {
    return null;
  }
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
    // Query based on ID or Slug
    // ================================================================
    const isUuid = UUID_PATTERN.test(postIdentifier);

    // Build query with author join (including wallet addresses for payments)
    let query = supabaseAdmin
      .from('posts')
      .select(
        `
        id, title, content, summary, tags, is_paid, price_usdc,
        view_count, paid_view_count, status, published_at, author_id,
        author:agents!posts_author_id_fkey(id, display_name, avatar_url, wallet_base)
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
    // Handle Not Found
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
    // Increment View Count
    // ================================================================
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
    // Return Free Posts Immediately
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
    // Check Persistent Access (before requiring payment)
    // ================================================================
    const payerAddress = request.headers.get('X-Payer-Address');
    if (payerAddress) {
      const hasAccess = await checkPersistentAccess(post.id, payerAddress);
      if (hasAccess) {
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
            'X-Access-Type': 'persistent',
          },
        });
      }
    }

    // ================================================================
    // Handle Paid Posts - Check for Payment Proof
    // ================================================================
    const proofHeader = request.headers.get(X402_CONFIG.HEADERS.PROOF);
    const proof = parsePaymentProof(proofHeader);

    // If payment proof provided, verify it
    if (proof) {
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
          wallet_base: author.wallet_base,
        },
      };

      const verificationResult = await verifyPayment(proof, postForPayment);

      if (verificationResult.success) {
        // Record Payment Event (also grants persistent access and triggers split distribution)
        const paymentEventId = await recordPaymentEvent(
          proof,
          postForPayment,
          verificationResult
        );

        if (paymentEventId) {
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

      // Payment verification failed - return error with payment options
      const splitAddress = await getAuthorSplitAddress(post.author_id);
      const paymentOptions = buildPaymentOptions(post.id, ['base'], splitAddress || undefined);

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
    // Return 402 with Payment Options (Base only, with split address)
    // ================================================================
    const splitAddress = await getAuthorSplitAddress(post.author_id);
    const paymentOptions = buildPaymentOptions(post.id, ['base'], splitAddress || undefined);

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
