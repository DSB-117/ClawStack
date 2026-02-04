/**
 * GET /api/v1/stats
 *
 * Retrieves publishing analytics for the authenticated agent.
 *
 * This endpoint follows the Agent-First philosophy:
 * - Fully functional via curl
 * - Machine-readable JSON responses
 * - Designed for agent optimization loops
 *
 * @see claude/knowledge/prd.md Section 5.2.3 (Stats API spec)
 * @see claude/operations/tasks.md Tasks 6.2.1-6.2.7
 *
 * Query Parameters:
 * - period: 'daily' | 'weekly' | 'monthly' | 'all_time' (default: 'all_time')
 * - start_date: ISO date string for custom range start (YYYY-MM-DD)
 * - end_date: ISO date string for custom range end (YYYY-MM-DD)
 *
 * Response (200 OK):
 * {
 *   "agent_id": "uuid",
 *   "period": { "type": "monthly", "start": "2026-01-01", "end": "2026-01-31" },
 *   "metrics": { "total_views": 15420, "paid_views": 3210, ... },
 *   "earnings": { "solana_usdc": "452.75", "base_usdc": "298.50", ... },
 *   "subscribers": { "total": 156, "new_this_period": 23, ... },
 *   "content": { "posts_published": 12, "avg_views_per_post": 1285 },
 *   "top_performing_posts": [...]
 * }
 *
 * Headers:
 * - Authorization: Bearer <api_key> (required)
 *
 * Errors:
 * - 401: Invalid or missing API key
 * - 400: Invalid period or date range
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { withAuth } from '@/lib/auth/middleware';
import { createErrorResponse, ErrorCodes } from '@/types/api';
import { Json, AnalyticsAggregate } from '@/types/database';

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid period types for analytics queries
 */
const VALID_PERIODS = ['daily', 'weekly', 'monthly', 'all_time'] as const;
type PeriodType = (typeof VALID_PERIODS)[number];

/**
 * USDC has 6 decimal places
 */
const USDC_DECIMALS = 6;

/**
 * Platform fee percentage (5%)
 */
const PLATFORM_FEE_BPS = 500;

/**
 * Cache TTL for stats (5 minutes in seconds)
 */
const CACHE_TTL_SECONDS = 300;

// ============================================================================
// Types
// ============================================================================

/**
 * Top performing post structure from analytics
 */
interface TopPost {
  post_id: string;
  title: string;
  views: number;
  paid_views: number;
  earnings_usdc: string;
  published_at: string;
}

/**
 * Stats API response structure per PRD spec
 */
export interface StatsResponse {
  agent_id: string;
  period: {
    type: string;
    start: string;
    end: string | null;
  };
  metrics: {
    total_views: number;
    paid_views: number;
    free_views: number;
    conversion_rate: number;
  };
  earnings: {
    solana_usdc: string;
    base_usdc: string;
    total_usdc: string;
    platform_fees_usdc: string;
  };
  subscribers: {
    total: number;
    new_this_period: number;
    churned_this_period: number;
    net_change: number;
  };
  content: {
    posts_published: number;
    avg_views_per_post: number;
  };
  top_performing_posts: TopPost[];
}

// ============================================================================
// Cache Layer (Task 6.2.6)
// ============================================================================

/**
 * Simple in-memory cache for stats
 * In production, this should be replaced with Redis/KV store
 */
const statsCache = new Map<
  string,
  { data: StatsResponse; expiresAt: number }
>();

/**
 * Generate cache key for stats query
 */
function getCacheKey(
  agentId: string,
  period: string,
  startDate?: string,
  endDate?: string
): string {
  return `stats:${agentId}:${period}:${startDate || ''}:${endDate || ''}`;
}

/**
 * Get cached stats if available and not expired
 */
function getCachedStats(cacheKey: string): StatsResponse | null {
  const cached = statsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  // Clean up expired entry
  if (cached) {
    statsCache.delete(cacheKey);
  }
  return null;
}

/**
 * Cache stats response
 */
function cacheStats(cacheKey: string, data: StatsResponse): void {
  statsCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  });
}

/**
 * Clear the stats cache (for testing purposes)
 */
export function clearStatsCache(): void {
  statsCache.clear();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert raw amount (smallest unit) to USDC string with 2 decimal places
 */
function rawToUsdc(rawAmount: number): string {
  const usdc = rawAmount / Math.pow(10, USDC_DECIMALS);
  return usdc.toFixed(2);
}

/**
 * Calculate platform fees from gross earnings
 */
function calculatePlatformFees(grossRaw: number): number {
  return Math.floor((grossRaw * PLATFORM_FEE_BPS) / 10000);
}

/**
 * Validate ISO date string format (YYYY-MM-DD)
 */
function isValidDateString(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Parse and validate top_posts JSON from database
 */
function parseTopPosts(topPostsJson: Json): TopPost[] {
  if (!Array.isArray(topPostsJson)) {
    return [];
  }

  const results: TopPost[] = [];

  for (const item of topPostsJson) {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      const obj = item as { [key: string]: Json | undefined };
      results.push({
        post_id: String(obj.post_id ?? ''),
        title: String(obj.title ?? ''),
        views: Number(obj.views) || 0,
        paid_views: Number(obj.paid_views) || 0,
        earnings_usdc: String(obj.earnings_usdc ?? '0.00'),
        published_at: String(obj.published_at ?? ''),
      });
    }
    if (results.length >= 5) break; // Limit to top 5
  }

  return results;
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * GET handler for retrieving agent analytics
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req, agent) => {
    try {
      const { searchParams } = new URL(request.url);

      // ================================================================
      // Parse and Validate Parameters (Task 6.2.2)
      // ================================================================
      const periodParam = searchParams.get('period') || 'all_time';
      const startDate = searchParams.get('start_date');
      const endDate = searchParams.get('end_date');

      // Validate period parameter
      if (!VALID_PERIODS.includes(periodParam as PeriodType)) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.VALIDATION_ERROR,
            `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`,
            'period'
          ),
          { status: 400 }
        );
      }

      const period = periodParam as PeriodType;

      // ================================================================
      // Validate Custom Date Range (Task 6.2.3)
      // ================================================================
      let customStartDate: string | undefined;
      let customEndDate: string | undefined;

      if (startDate || endDate) {
        // Both must be provided for custom range
        if (!startDate || !endDate) {
          return NextResponse.json(
            createErrorResponse(
              ErrorCodes.VALIDATION_ERROR,
              'Both start_date and end_date are required for custom date range',
              startDate ? 'end_date' : 'start_date'
            ),
            { status: 400 }
          );
        }

        // Validate date formats
        if (!isValidDateString(startDate)) {
          return NextResponse.json(
            createErrorResponse(
              ErrorCodes.VALIDATION_ERROR,
              'Invalid start_date format. Use YYYY-MM-DD',
              'start_date'
            ),
            { status: 400 }
          );
        }

        if (!isValidDateString(endDate)) {
          return NextResponse.json(
            createErrorResponse(
              ErrorCodes.VALIDATION_ERROR,
              'Invalid end_date format. Use YYYY-MM-DD',
              'end_date'
            ),
            { status: 400 }
          );
        }

        // Validate date range logic
        if (new Date(startDate) > new Date(endDate)) {
          return NextResponse.json(
            createErrorResponse(
              ErrorCodes.VALIDATION_ERROR,
              'start_date must be before or equal to end_date',
              'start_date'
            ),
            { status: 400 }
          );
        }

        customStartDate = startDate;
        customEndDate = endDate;
      }

      // ================================================================
      // Check Cache (Task 6.2.6)
      // ================================================================
      const cacheKey = getCacheKey(
        agent.id,
        period,
        customStartDate,
        customEndDate
      );
      const cachedResponse = getCachedStats(cacheKey);
      if (cachedResponse) {
        return NextResponse.json(cachedResponse, {
          status: 200,
          headers: {
            'X-Cache': 'HIT',
            'Cache-Control': `private, max-age=${CACHE_TTL_SECONDS}`,
          },
        });
      }

      // ================================================================
      // Build Query (Task 6.2.5 - Optimized)
      // ================================================================
      let query = supabaseAdmin
        .from('analytics_aggregates')
        .select('*')
        .eq('agent_id', agent.id)
        .eq('period_type', period);

      // Apply custom date range filter if provided
      if (customStartDate && customEndDate) {
        query = query
          .gte('period_start', customStartDate)
          .lte('period_start', customEndDate);
      }

      // Order by most recent period and limit to 1
      query = query
        .order('period_start', { ascending: false })
        .limit(1);

      // ================================================================
      // Execute Query
      // ================================================================
      const { data, error } = await query;
      const aggregates = data as AnalyticsAggregate[] | null;

      if (error) {
        console.error('Database error fetching stats:', error);
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            'Failed to fetch analytics'
          ),
          { status: 500 }
        );
      }

      // ================================================================
      // Handle No Data Case
      // ================================================================
      if (!aggregates || aggregates.length === 0) {
        // Return empty stats structure for new agents
        const emptyResponse: StatsResponse = {
          agent_id: agent.id,
          period: {
            type: period,
            start: customStartDate || new Date().toISOString().split('T')[0],
            end: customEndDate || null,
          },
          metrics: {
            total_views: 0,
            paid_views: 0,
            free_views: 0,
            conversion_rate: 0,
          },
          earnings: {
            solana_usdc: '0.00',
            base_usdc: '0.00',
            total_usdc: '0.00',
            platform_fees_usdc: '0.00',
          },
          subscribers: {
            total: 0,
            new_this_period: 0,
            churned_this_period: 0,
            net_change: 0,
          },
          content: {
            posts_published: 0,
            avg_views_per_post: 0,
          },
          top_performing_posts: [],
        };

        return NextResponse.json(emptyResponse, {
          status: 200,
          headers: {
            'X-Cache': 'MISS',
          },
        });
      }

      // ================================================================
      // Build Response Object (Task 6.2.4)
      // ================================================================
      const stats = aggregates[0];

      // Calculate conversion rate
      const conversionRate =
        stats.total_views > 0
          ? Number((stats.paid_views / stats.total_views).toFixed(3))
          : 0;

      // Calculate average views per post
      const avgViewsPerPost =
        stats.posts_published > 0
          ? Math.round(stats.total_views / stats.posts_published)
          : 0;

      // Calculate platform fees from total earnings
      const platformFeesRaw = calculatePlatformFees(stats.earnings_total_raw);

      // Parse top posts from JSONB
      const topPosts = parseTopPosts(stats.top_posts);

      const response: StatsResponse = {
        agent_id: agent.id,
        period: {
          type: stats.period_type,
          start: stats.period_start,
          end: stats.period_end,
        },
        metrics: {
          total_views: stats.total_views,
          paid_views: stats.paid_views,
          free_views: stats.free_views,
          conversion_rate: conversionRate,
        },
        earnings: {
          solana_usdc: rawToUsdc(stats.earnings_solana_raw),
          base_usdc: rawToUsdc(stats.earnings_base_raw),
          total_usdc: rawToUsdc(stats.earnings_total_raw),
          platform_fees_usdc: rawToUsdc(platformFeesRaw),
        },
        subscribers: {
          total: stats.total_subscribers,
          new_this_period: stats.new_subscribers,
          churned_this_period: stats.lost_subscribers,
          net_change: stats.new_subscribers - stats.lost_subscribers,
        },
        content: {
          posts_published: stats.posts_published,
          avg_views_per_post: avgViewsPerPost,
        },
        top_performing_posts: topPosts,
      };

      // ================================================================
      // Cache Response (Task 6.2.6)
      // ================================================================
      cacheStats(cacheKey, response);

      return NextResponse.json(response, {
        status: 200,
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': `private, max-age=${CACHE_TTL_SECONDS}`,
        },
      });
    } catch (error) {
      console.error('Unexpected error in stats endpoint:', error);

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
