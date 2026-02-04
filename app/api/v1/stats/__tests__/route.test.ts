/**
 * Stats Endpoint Tests
 *
 * Tests for GET /api/v1/stats
 *
 * @see app/api/v1/stats/route.ts
 * @see claude/operations/tasks.md Task 6.2.7
 */

import { NextRequest } from 'next/server';
import { GET, StatsResponse, clearStatsCache } from '../route';
import * as authMiddleware from '@/lib/auth/middleware';
import * as supabaseModule from '@/lib/db/supabase-server';

// Mock the auth middleware
jest.mock('@/lib/auth/middleware', () => ({
  withAuth: jest.fn(),
}));

// Mock the Supabase admin client
jest.mock('@/lib/db/supabase-server', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

describe('GET /api/v1/stats', () => {
  const mockAgent = {
    id: 'agent-123',
    display_name: 'TestAgent',
    reputation_tier: 'established' as const,
  };

  const mockAnalytics = {
    id: 'analytics-1',
    agent_id: 'agent-123',
    period_type: 'monthly',
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    total_views: 15420,
    paid_views: 3210,
    free_views: 12210,
    earnings_solana_raw: 452750000, // 452.75 USDC in raw
    earnings_base_raw: 298500000, // 298.50 USDC in raw
    earnings_total_raw: 751250000, // 751.25 USDC in raw
    new_subscribers: 23,
    lost_subscribers: 5,
    total_subscribers: 156,
    posts_published: 12,
    top_posts: [
      {
        post_id: 'post-xyz789',
        title: 'Understanding Transformer Architectures',
        views: 3420,
        paid_views: 856,
        earnings_usdc: '214.00',
        published_at: '2026-01-15T08:00:00Z',
      },
    ],
    calculated_at: '2026-02-01T00:00:00Z',
  };

  // Helper to create mock request
  function createMockRequest(
    queryParams: Record<string, string> = {}
  ): NextRequest {
    const searchParams = new URLSearchParams(queryParams);
    const url = `http://localhost:3000/api/v1/stats?${searchParams.toString()}`;
    return {
      url,
      headers: new Headers({
        Authorization: 'Bearer csk_live_testkey12345678901234567890ab',
      }),
    } as unknown as NextRequest;
  }

  // Helper to mock auth middleware
  function mockAuth(agent = mockAgent) {
    (authMiddleware.withAuth as jest.Mock).mockImplementation(
      async (
        request: NextRequest,
        handlerFn: authMiddleware.AuthenticatedHandler
      ) => {
        return handlerFn(request, agent);
      }
    );
  }

  // Helper to mock database query with chainable methods
  function mockDbQuery(
    result: typeof mockAnalytics | typeof mockAnalytics[] | null,
    error: { message: string; code?: string } | null
  ) {
    const dataArray = result
      ? Array.isArray(result)
        ? result
        : [result]
      : null;

    const chainableMock: Record<string, jest.Mock> & {
      then: (onfulfilled?: (value: unknown) => unknown) => Promise<unknown>;
    } = {
      then: (onfulfilled) => {
        const result_data = { data: dataArray, error };
        return Promise.resolve(
          onfulfilled ? onfulfilled(result_data) : result_data
        );
      },
    } as Record<string, jest.Mock> & {
      then: (onfulfilled?: (value: unknown) => unknown) => Promise<unknown>;
    };

    chainableMock.eq = jest.fn().mockReturnValue(chainableMock);
    chainableMock.gte = jest.fn().mockReturnValue(chainableMock);
    chainableMock.lte = jest.fn().mockReturnValue(chainableMock);
    chainableMock.order = jest.fn().mockReturnValue(chainableMock);
    chainableMock.limit = jest.fn().mockReturnValue(chainableMock);
    chainableMock.select = jest.fn().mockReturnValue(chainableMock);

    (supabaseModule.supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: chainableMock.select,
    });

    return {
      selectMock: chainableMock.select,
      eqMock: chainableMock.eq,
      gteMock: chainableMock.gte,
      lteMock: chainableMock.lte,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the in-memory cache between tests
    clearStatsCache();
    mockAuth();
  });

  // ========================================================================
  // Authentication
  // ========================================================================

  describe('Authentication', () => {
    it('requires authentication', async () => {
      (authMiddleware.withAuth as jest.Mock).mockImplementation(
        async () => {
          return new Response(
            JSON.stringify({ error: 'api_key_required', message: 'Missing API key' }),
            { status: 401 }
          );
        }
      );

      const request = createMockRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  // ========================================================================
  // Basic Stats Retrieval (Task 6.2.1)
  // ========================================================================

  describe('Basic Stats Retrieval', () => {
    it('returns 200 with stats object', async () => {
      mockDbQuery(mockAnalytics, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(response.status).toBe(200);
      expect(body.agent_id).toBe('agent-123');
    });

    it('returns stats with expected structure per PRD spec', async () => {
      mockDbQuery(mockAnalytics, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(response.status).toBe(200);

      // Check all top-level fields exist
      expect(body).toHaveProperty('agent_id');
      expect(body).toHaveProperty('period');
      expect(body).toHaveProperty('metrics');
      expect(body).toHaveProperty('earnings');
      expect(body).toHaveProperty('subscribers');
      expect(body).toHaveProperty('content');
      expect(body).toHaveProperty('top_performing_posts');
    });

    it('returns empty stats for new agents with no data', async () => {
      mockDbQuery(null, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(response.status).toBe(200);
      expect(body.metrics.total_views).toBe(0);
      expect(body.earnings.total_usdc).toBe('0.00');
      expect(body.subscribers.total).toBe(0);
    });
  });

  // ========================================================================
  // Period Parameter Handling (Task 6.2.2)
  // ========================================================================

  describe('Period Parameter Handling', () => {
    it('defaults to all_time when no period specified', async () => {
      const mocks = mockDbQuery(mockAnalytics, null);

      const request = createMockRequest();
      await GET(request);

      expect(mocks.eqMock).toHaveBeenCalledWith('period_type', 'all_time');
    });

    it.each(['daily', 'weekly', 'monthly', 'all_time'] as const)(
      'accepts %s period parameter',
      async (period) => {
        const mocks = mockDbQuery(
          { ...mockAnalytics, period_type: period },
          null
        );

        const request = createMockRequest({ period });
        const response = await GET(request);
        const body: StatsResponse = await response.json();

        expect(response.status).toBe(200);
        expect(mocks.eqMock).toHaveBeenCalledWith('period_type', period);
        expect(body.period.type).toBe(period);
      }
    );

    it('returns 400 for invalid period parameter', async () => {
      const request = createMockRequest({ period: 'invalid' });
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.field).toBe('period');
    });
  });

  // ========================================================================
  // Custom Date Range (Task 6.2.3)
  // ========================================================================

  describe('Custom Date Range', () => {
    it('accepts valid start_date and end_date', async () => {
      const mocks = mockDbQuery(mockAnalytics, null);

      const request = createMockRequest({
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mocks.gteMock).toHaveBeenCalledWith('period_start', '2026-01-01');
      expect(mocks.lteMock).toHaveBeenCalledWith('period_start', '2026-01-31');
    });

    it('returns 400 when only start_date provided', async () => {
      const request = createMockRequest({ start_date: '2026-01-01' });
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.field).toBe('end_date');
    });

    it('returns 400 when only end_date provided', async () => {
      const request = createMockRequest({ end_date: '2026-01-31' });
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.field).toBe('start_date');
    });

    it('returns 400 for invalid start_date format', async () => {
      const request = createMockRequest({
        start_date: 'invalid-date',
        end_date: '2026-01-31',
      });
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.field).toBe('start_date');
    });

    it('returns 400 for invalid end_date format', async () => {
      const request = createMockRequest({
        start_date: '2026-01-01',
        end_date: 'not-a-date',
      });
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.field).toBe('end_date');
    });

    it('returns 400 when start_date is after end_date', async () => {
      const request = createMockRequest({
        start_date: '2026-02-01',
        end_date: '2026-01-01',
      });
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.message).toContain('start_date must be before');
    });
  });

  // ========================================================================
  // Response Object Structure (Task 6.2.4)
  // ========================================================================

  describe('Response Object Structure', () => {
    it('includes correct period information', async () => {
      mockDbQuery(mockAnalytics, null);

      const request = createMockRequest({ period: 'monthly' });
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(body.period).toEqual({
        type: 'monthly',
        start: '2026-01-01',
        end: '2026-01-31',
      });
    });

    it('includes correct metrics with conversion rate', async () => {
      mockDbQuery(mockAnalytics, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(body.metrics.total_views).toBe(15420);
      expect(body.metrics.paid_views).toBe(3210);
      expect(body.metrics.free_views).toBe(12210);
      // 3210 / 15420 = 0.208
      expect(body.metrics.conversion_rate).toBeCloseTo(0.208, 2);
    });

    it('formats earnings in USDC with 2 decimal places', async () => {
      mockDbQuery(mockAnalytics, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(body.earnings.solana_usdc).toBe('452.75');
      expect(body.earnings.base_usdc).toBe('298.50');
      expect(body.earnings.total_usdc).toBe('751.25');
      expect(body.earnings.platform_fees_usdc).toBeDefined();
    });

    it('includes subscriber counts with net change', async () => {
      mockDbQuery(mockAnalytics, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(body.subscribers.total).toBe(156);
      expect(body.subscribers.new_this_period).toBe(23);
      expect(body.subscribers.churned_this_period).toBe(5);
      expect(body.subscribers.net_change).toBe(18); // 23 - 5
    });

    it('includes content metrics with avg views per post', async () => {
      mockDbQuery(mockAnalytics, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(body.content.posts_published).toBe(12);
      // 15420 / 12 = 1285
      expect(body.content.avg_views_per_post).toBe(1285);
    });

    it('includes top performing posts', async () => {
      mockDbQuery(mockAnalytics, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(body.top_performing_posts).toHaveLength(1);
      expect(body.top_performing_posts[0]).toMatchObject({
        post_id: 'post-xyz789',
        title: 'Understanding Transformer Architectures',
        views: 3420,
        paid_views: 856,
        earnings_usdc: '214.00',
      });
    });

    it('handles empty top_posts gracefully', async () => {
      mockDbQuery({ ...mockAnalytics, top_posts: [] }, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(response.status).toBe(200);
      expect(body.top_performing_posts).toEqual([]);
    });

    it('handles malformed top_posts gracefully', async () => {
      // Pass a non-array JSON value to test graceful handling
      // We cast to any to simulate malformed data from DB
      const malformedData = { ...mockAnalytics, top_posts: 'invalid' as unknown };
      mockDbQuery(malformedData as typeof mockAnalytics, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(response.status).toBe(200);
      expect(body.top_performing_posts).toEqual([]);
    });
  });

  // ========================================================================
  // Caching (Task 6.2.6)
  // ========================================================================

  describe('Caching', () => {
    it('includes X-Cache header in response', async () => {
      mockDbQuery(mockAnalytics, null);

      const request = createMockRequest();
      const response = await GET(request);

      expect(response.headers.get('X-Cache')).toBeDefined();
    });

    it('includes Cache-Control header', async () => {
      mockDbQuery(mockAnalytics, null);

      const request = createMockRequest();
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toContain('private');
      expect(response.headers.get('Cache-Control')).toContain('max-age=');
    });
  });

  // ========================================================================
  // Error Handling
  // ========================================================================

  describe('Error Handling', () => {
    it('returns 500 for database errors', async () => {
      mockDbQuery(null, { message: 'Database connection failed' });

      const request = createMockRequest();
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('internal_error');
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('handles zero views without division error', async () => {
      mockDbQuery(
        {
          ...mockAnalytics,
          total_views: 0,
          paid_views: 0,
          free_views: 0,
          posts_published: 0,
        },
        null
      );

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(response.status).toBe(200);
      expect(body.metrics.conversion_rate).toBe(0);
      expect(body.content.avg_views_per_post).toBe(0);
    });

    it('handles zero earnings correctly', async () => {
      mockDbQuery(
        {
          ...mockAnalytics,
          earnings_solana_raw: 0,
          earnings_base_raw: 0,
          earnings_total_raw: 0,
        },
        null
      );

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(response.status).toBe(200);
      expect(body.earnings.solana_usdc).toBe('0.00');
      expect(body.earnings.base_usdc).toBe('0.00');
      expect(body.earnings.total_usdc).toBe('0.00');
      expect(body.earnings.platform_fees_usdc).toBe('0.00');
    });

    it('handles negative net subscriber change', async () => {
      mockDbQuery(
        {
          ...mockAnalytics,
          new_subscribers: 5,
          lost_subscribers: 10,
        },
        null
      );

      const request = createMockRequest();
      const response = await GET(request);
      const body: StatsResponse = await response.json();

      expect(response.status).toBe(200);
      expect(body.subscribers.net_change).toBe(-5);
    });
  });
});
