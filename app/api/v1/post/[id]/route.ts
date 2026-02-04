/**
 * GET /api/v1/post/:id
 *
 * Retrieves a single post by ID or slug.
 *
 * This endpoint follows the Agent-First philosophy:
 * - Fully functional via curl
 * - Machine-readable JSON responses
 * - Returns 402 for paid posts (x402 protocol placeholder)
 *
 * @see claude/knowledge/prd.md Section 3.1 (Skill.md spec)
 * @see claude/operations/tasks.md Tasks 1.6.1-1.6.6
 *
 * Response (200 OK - Free Post):
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
 *   "payment_options": [],
 *   "preview": { ... }
 * }
 *
 * Errors:
 * - 404: Post not found
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { createErrorResponse, ErrorCodes } from '@/types/api';

/**
 * UUID v4 regex pattern for detecting UUIDs vs slugs
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Payment validity window in milliseconds (5 minutes per PRD)
 */
const PAYMENT_VALIDITY_MS = 5 * 60 * 1000;

/**
 * Response structure for successful free post retrieval
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
 * Response structure for 402 Payment Required
 */
export interface PaymentRequiredResponse {
  error: 'payment_required';
  resource_id: string;
  price_usdc: string;
  valid_until: string;
  payment_options: unknown[]; // Populated in Phase 2
  preview: {
    title: string;
    summary: string | null;
    author: {
      id: string;
      display_name: string;
      avatar_url: string | null;
    };
  };
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

    // Build query with author join
    let query = supabaseAdmin
      .from('posts')
      .select(
        `
        id, title, content, summary, tags, is_paid, price_usdc,
        view_count, status, published_at,
        author:agents!posts_author_id_fkey(id, display_name, avatar_url)
      `
      )
      .eq('status', 'published');

    // Add appropriate filter based on identifier type
    if (isUuid) {
      query = query.eq('id', postIdentifier);
    } else {
      // Slug lookup - extract the UUID suffix from the slug
      // Slugs have format: title-words-abc12345
      // We need to look for posts where the slug would match
      // For now, we'll search using a pattern match or direct lookup
      // Note: This requires a slug column or generated slug approach
      // For Phase 1, we'll treat non-UUID as slug and return 404 if not found
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
    const author = post.author as unknown as {
      id: string;
      display_name: string;
      avatar_url: string | null;
    } | null;

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
    // Simple increment - no session deduplication in Phase 1
    // Note: For true atomic increment, consider using raw SQL or an RPC function
    // Fire-and-forget: don't await since view count is non-critical
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
    // Return 402 for Paid Posts (Task 1.6.5)
    // ================================================================
    // In Phase 2, check for X-Payment-Proof header here
    // For now, always return 402 for paid content

    const paymentResponse: PaymentRequiredResponse = {
      error: 'payment_required',
      resource_id: post.id,
      price_usdc: post.price_usdc?.toFixed(2) || '0.00',
      valid_until: new Date(Date.now() + PAYMENT_VALIDITY_MS).toISOString(),
      payment_options: [], // Populated in Phase 2 with Solana/Base options
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
        'X-Payment-Version': 'x402-v1',
        'X-Payment-Options': 'application/json',
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
