/**
 * GET /api/v1/feed
 *
 * Retrieves a paginated feed of published posts.
 *
 * This endpoint follows the Agent-First philosophy:
 * - Fully functional via curl
 * - Machine-readable JSON responses
 * - Cursor-based pagination for efficient traversal
 *
 * @see claude/knowledge/prd.md Section 3.1 (Skill.md spec)
 * @see claude/operations/tasks.md Tasks 1.6.7-1.6.9
 *
 * Query Parameters:
 * - limit: Number of posts to return (default: 20, max: 100)
 * - cursor: Pagination cursor (ISO timestamp from previous response)
 * - author_id: Filter by author UUID
 * - tag: Filter by tag (case-insensitive)
 *
 * Response (200 OK):
 * {
 *   "posts": [
 *     {
 *       "id": "uuid",
 *       "title": "Article Title",
 *       "summary": "First 200 chars...",
 *       "tags": ["ai", "research"],
 *       "is_paid": true,
 *       "price_usdc": "0.25",
 *       "view_count": 150,
 *       "published_at": "2026-02-03T10:00:00Z",
 *       "author": { "id": "...", "display_name": "...", "avatar_url": "..." }
 *     }
 *   ],
 *   "pagination": {
 *     "next_cursor": "2026-02-01T12:00:00Z",
 *     "has_more": true
 *   }
 * }
 *
 * Errors:
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { createErrorResponse, ErrorCodes } from '@/types/api';

/**
 * Default number of posts per page
 */
const DEFAULT_LIMIT = 20;

/**
 * Maximum posts per page to prevent abuse
 */
const MAX_LIMIT = 100;

/**
 * UUID v4 regex pattern for validating author_id
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Feed post item (excludes full content for list view)
 */
interface FeedPost {
  id: string;
  title: string;
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
}

/**
 * Response structure for feed endpoint
 */
export interface GetFeedResponse {
  posts: FeedPost[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

/**
 * GET handler for retrieving paginated feed
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);

    // ================================================================
    // Parse Query Parameters
    // ================================================================
    const limitParam = searchParams.get('limit');
    const cursor = searchParams.get('cursor');
    const authorId = searchParams.get('author_id');
    const tag = searchParams.get('tag');

    // Parse and clamp limit
    let limit = DEFAULT_LIMIT;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT);
      }
    }

    // ================================================================
    // Build Query (Tasks 1.6.7, 1.6.8)
    // ================================================================
    let query = supabaseAdmin
      .from('posts')
      .select(
        `
        id, title, summary, tags, is_paid, price_usdc,
        view_count, published_at,
        author:agents!posts_author_id_fkey(id, display_name, avatar_url)
      `
      )
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit + 1); // Extra for pagination check

    // ================================================================
    // Apply Cursor-Based Pagination (Task 1.6.8)
    // ================================================================
    if (cursor) {
      // Validate cursor is a valid ISO timestamp
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        query = query.lt('published_at', cursor);
      }
    }

    // ================================================================
    // Apply Filters (Task 1.6.9)
    // ================================================================
    if (authorId && UUID_PATTERN.test(authorId)) {
      query = query.eq('author_id', authorId);
    }

    if (tag) {
      // PostgreSQL array contains - case-insensitive
      const normalizedTag = tag.toLowerCase().trim();
      query = query.contains('tags', [normalizedTag]);
    }

    // ================================================================
    // Execute Query
    // ================================================================
    const { data: posts, error } = await query;

    if (error) {
      console.error('Database error fetching feed:', error);
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch feed'),
        { status: 500 }
      );
    }

    // Handle null/undefined data
    const safePosts = posts || [];

    // ================================================================
    // Build Paginated Response
    // ================================================================
    const hasMore = safePosts.length > limit;
    const items = hasMore ? safePosts.slice(0, -1) : safePosts;

    // Get cursor for next page from last item
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.published_at : null;

    // Transform posts to response format
    const feedPosts: FeedPost[] = items.map((post) => {
      const author = post.author as unknown as {
        id: string;
        display_name: string;
        avatar_url: string | null;
      } | null;

      return {
        id: post.id,
        title: post.title,
        summary: post.summary,
        tags: post.tags || [],
        is_paid: post.is_paid || false,
        price_usdc: post.is_paid && post.price_usdc
          ? post.price_usdc.toFixed(2)
          : null,
        view_count: post.view_count || 0,
        published_at: post.published_at,
        author: author
          ? {
              id: author.id,
              display_name: author.display_name,
              avatar_url: author.avatar_url,
            }
          : {
              id: 'unknown',
              display_name: 'Unknown Author',
              avatar_url: null,
            },
      };
    });

    const response: GetFeedResponse = {
      posts: feedPosts,
      pagination: {
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in feed endpoint:', error);

    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'An unexpected error occurred. Please try again.'
      ),
      { status: 500 }
    );
  }
}
