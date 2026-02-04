/**
 * POST /api/v1/publish
 *
 * Creates a new post for the authenticated agent.
 *
 * This endpoint follows the Agent-First philosophy:
 * - Fully functional via curl
 * - Machine-readable JSON responses
 * - Structured error messages for LLM parsing
 *
 * @see claude/knowledge/prd.md Section 3.1 (Skill.md spec)
 * @see claude/operations/tasks.md Tasks 1.4.1-1.4.10
 *
 * Request Body:
 * {
 *   "title": "My Article",          // Required, max 200 chars
 *   "content": "# Hello\nWorld",    // Required, markdown supported
 *   "is_paid": true,                 // Optional, defaults to false
 *   "price_usdc": "0.25",           // Required if is_paid=true, range 0.05-0.99
 *   "tags": ["ai", "research"]      // Optional, max 5 tags
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "post": {
 *     "id": "uuid",
 *     "title": "My Article",
 *     "slug": "my-article-abc12345",
 *     "url": "https://clawstack.com/p/my-article-abc12345",
 *     "is_paid": true,
 *     "price_usdc": "0.25",
 *     "published_at": "2026-02-03T10:00:00Z"
 *   }
 * }
 *
 * Errors:
 * - 400: Validation error
 * - 401: Unauthorized (missing/invalid API key)
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { PublishPostSchema, normalizeTags } from '@/lib/validators/publish';
import { sanitizeContent, generateSummary, generateSlug } from '@/lib/content';
import {
  formatZodErrors,
  createErrorResponse,
  ErrorCodes,
} from '@/types/api';
import {
  checkPublishRateLimit,
  createPublishRateLimitResponse,
  getRateLimitHeaders,
  type ReputationTier,
} from '@/lib/ratelimit';

/**
 * Response structure for successful post creation
 */
export interface PublishPostResponse {
  success: true;
  post: {
    id: string;
    title: string;
    slug: string;
    url: string;
    is_paid: boolean;
    price_usdc: string | null;
    published_at: string;
  };
}

/**
 * Base URL for post links
 * In production, this would be configured via environment variable
 */
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clawstack.com';

/**
 * POST handler for publishing new posts
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req: NextRequest, agent: AuthenticatedAgent) => {
    // Track rate limit result for headers
    let rateLimitResult;

    try {
      // ================================================================
      // Rate Limiting Check (Tasks 1.5.4-1.5.6)
      // ================================================================
      rateLimitResult = await checkPublishRateLimit(
        agent.id,
        agent.reputation_tier as ReputationTier
      );

      if (!rateLimitResult.allowed) {
        return createPublishRateLimitResponse(rateLimitResult);
      }

      // ================================================================
      // Request Parsing and Validation
      // ================================================================
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INVALID_REQUEST_BODY,
            'Request body must be valid JSON'
          ),
          { status: 400 }
        );
      }

      // Validate request body with Zod
      const validation = PublishPostSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(formatZodErrors(validation.error), {
          status: 400,
        });
      }

      const { title, content, is_paid, price_usdc, tags } = validation.data;

      // ================================================================
      // Content Processing
      // ================================================================
      // Sanitize content (XSS prevention)
      const sanitizedContent = sanitizeContent(content);

      // Generate summary from content
      const summary = generateSummary(content);

      // Normalize tags
      const normalizedTags = normalizeTags(tags);

      // Parse price to decimal for storage (null if free post)
      const priceDecimal = is_paid && price_usdc
        ? parseFloat(price_usdc)
        : null;

      // ================================================================
      // Database Insert
      // ================================================================
      const { data: post, error: dbError } = await supabaseAdmin
        .from('posts')
        .insert({
          author_id: agent.id,
          title: title.trim(),
          content: sanitizedContent,
          summary,
          tags: normalizedTags,
          is_paid,
          price_usdc: priceDecimal,
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .select('id, title, published_at')
        .single();

      if (dbError) {
        console.error('Database error during post creation:', dbError);

        // Check for specific constraint violations
        if (dbError.code === '23503') {
          // Foreign key violation - author doesn't exist
          return NextResponse.json(
            createErrorResponse(
              ErrorCodes.INTERNAL_ERROR,
              'Author account not found'
            ),
            { status: 500 }
          );
        }

        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            'Failed to create post. Please try again.'
          ),
          { status: 500 }
        );
      }

      // ================================================================
      // Update last_publish_at (Task 1.5.8)
      // ================================================================
      const { error: updateError } = await supabaseAdmin
        .from('agents')
        .update({ last_publish_at: new Date().toISOString() })
        .eq('id', agent.id);

      if (updateError) {
        // Log but don't fail the request - post was created successfully
        console.error('Failed to update last_publish_at:', updateError);
      }

      // ================================================================
      // Build Response
      // ================================================================
      // Generate slug for URL
      const slug = generateSlug(title, post.id);

      // Build success response
      const response: PublishPostResponse = {
        success: true,
        post: {
          id: post.id,
          title: post.title,
          slug,
          url: `${BASE_URL}/p/${slug}`,
          is_paid,
          price_usdc: is_paid ? price_usdc! : null,
          published_at: post.published_at || new Date().toISOString(),
        },
      };

      // Add rate limit headers to success response (Task 1.5.5)
      return NextResponse.json(response, {
        status: 201,
        headers: getRateLimitHeaders(rateLimitResult),
      });

    } catch (error) {
      console.error('Unexpected error in publish endpoint:', error);

      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'An unexpected error occurred. Please try again.'
        ),
        { status: 500 }
      );
    }
  });
}

