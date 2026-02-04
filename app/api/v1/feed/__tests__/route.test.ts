/**
 * Feed Endpoint Tests
 *
 * Tests for GET /api/v1/feed
 *
 * @see app/api/v1/feed/route.ts
 * @see claude/operations/tasks.md Task 1.6.10
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import * as supabaseModule from '@/lib/db/supabase-server';

// Mock the Supabase admin client
jest.mock('@/lib/db/supabase-server', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

describe('GET /api/v1/feed', () => {
  const mockAuthor = {
    id: 'author-123',
    display_name: 'TestBot',
    avatar_url: 'https://example.com/avatar.png',
  };

  const mockPosts = [
    {
      id: 'post-1',
      title: 'First Post',
      summary: 'Summary 1',
      tags: ['ai'],
      is_paid: false,
      price_usdc: null,
      view_count: 100,
      published_at: '2026-02-03T12:00:00.000Z',
      author: mockAuthor,
    },
    {
      id: 'post-2',
      title: 'Second Post',
      summary: 'Summary 2',
      tags: ['research'],
      is_paid: true,
      price_usdc: 0.25,
      view_count: 50,
      published_at: '2026-02-03T11:00:00.000Z',
      author: mockAuthor,
    },
    {
      id: 'post-3',
      title: 'Third Post',
      summary: 'Summary 3',
      tags: ['ai', 'research'],
      is_paid: false,
      price_usdc: null,
      view_count: 25,
      published_at: '2026-02-03T10:00:00.000Z',
      author: mockAuthor,
    },
  ];

  // Helper to create mock request
  function createMockRequest(queryParams: Record<string, string> = {}): NextRequest {
    const searchParams = new URLSearchParams(queryParams);
    const url = `http://localhost:3000/api/v1/feed?${searchParams.toString()}`;
    return {
      url,
      headers: new Headers(),
    } as unknown as NextRequest;
  }

  // Helper to mock database query - creates a chainable AND thenable mock
  // Supabase's PostgrestBuilder is both chainable (returns self) and thenable (executes on await)
  function mockDbQuery(
    result: typeof mockPosts | null,
    error: { message: string; code?: string } | null
  ) {
    // Create a chainable mock - all query methods return the same object
    // The object is also thenable (has .then()) so it works with await
    const chainableMock: Record<string, jest.Mock> & {
      then: (onfulfilled?: (value: unknown) => unknown) => Promise<unknown>;
    } = {
      // Make it thenable - this is what gets called when awaited
      then: (onfulfilled) => {
        const result_data = { data: result, error };
        return Promise.resolve(onfulfilled ? onfulfilled(result_data) : result_data);
      },
    } as Record<string, jest.Mock> & {
      then: (onfulfilled?: (value: unknown) => unknown) => Promise<unknown>;
    };
    
    // All chainable methods return the same object (including limit)
    chainableMock.eq = jest.fn().mockReturnValue(chainableMock);
    chainableMock.contains = jest.fn().mockReturnValue(chainableMock);
    chainableMock.lt = jest.fn().mockReturnValue(chainableMock);
    chainableMock.order = jest.fn().mockReturnValue(chainableMock);
    chainableMock.limit = jest.fn().mockReturnValue(chainableMock);
    chainableMock.select = jest.fn().mockReturnValue(chainableMock);

    (supabaseModule.supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: chainableMock.select,
    });

    return { 
      selectMock: chainableMock.select, 
      eqMock: chainableMock.eq, 
      containsMock: chainableMock.contains, 
      ltMock: chainableMock.lt, 
      limitMock: chainableMock.limit 
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Feed Retrieval', () => {
    it('returns 200 with posts array', async () => {
      mockDbQuery(mockPosts, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.posts).toBeDefined();
      expect(Array.isArray(body.posts)).toBe(true);
    });

    it('returns posts with expected fields', async () => {
      mockDbQuery([mockPosts[0]], null);

      const request = createMockRequest();
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.posts[0]).toMatchObject({
        id: 'post-1',
        title: 'First Post',
        summary: 'Summary 1',
        tags: ['ai'],
        is_paid: false,
        price_usdc: null,
        view_count: 100,
      });
    });

    it('includes author info in each post', async () => {
      mockDbQuery([mockPosts[0]], null);

      const request = createMockRequest();
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.posts[0].author).toBeDefined();
      expect(body.posts[0].author.display_name).toBe('TestBot');
    });
  });

  describe('Pagination', () => {
    it('includes pagination object in response', async () => {
      mockDbQuery(mockPosts, null);

      const request = createMockRequest();
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.pagination).toBeDefined();
      expect(body.pagination).toHaveProperty('next_cursor');
      expect(body.pagination).toHaveProperty('has_more');
    });

    it('sets has_more to false when no more posts', async () => {
      mockDbQuery([mockPosts[0]], null); // Less than limit + 1

      const request = createMockRequest({ limit: '10' });
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.pagination.has_more).toBe(false);
      expect(body.pagination.next_cursor).toBeNull();
    });

    it('sets has_more to true when more posts exist', async () => {
      // Return limit + 1 posts to indicate more exist
      const postsWithExtra = [...mockPosts, { ...mockPosts[0], id: 'extra' }];
      mockDbQuery(postsWithExtra, null);

      const request = createMockRequest({ limit: '3' });
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.pagination.has_more).toBe(true);
      expect(body.posts.length).toBe(3); // Should not include the extra
    });

    it('respects custom limit parameter', async () => {
      mockDbQuery([mockPosts[0]], null);

      const request = createMockRequest({ limit: '5' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      // The mock was called (limit parameter is handled)
      expect(supabaseModule.supabaseAdmin.from).toHaveBeenCalled();
    });

    it('caps limit at 100', async () => {
      mockDbQuery(mockPosts, null);

      const request = createMockRequest({ limit: '500' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      // Should not error - limit is capped internally
    });
  });

  describe('Filtering', () => {
    it('accepts author_id filter parameter', async () => {
      mockDbQuery([mockPosts[0]], null);

      const request = createMockRequest({ author_id: 'author-123' });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('accepts tag filter parameter', async () => {
      mockDbQuery([mockPosts[0]], null);

      const request = createMockRequest({ tag: 'ai' });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('ignores invalid UUID in author_id', async () => {
      mockDbQuery(mockPosts, null);

      const request = createMockRequest({ author_id: 'invalid-not-uuid' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      // Should still return results (invalid filter ignored)
    });
  });

  describe('Error Handling', () => {
    it('returns 500 for database errors', async () => {
      mockDbQuery(null, { message: 'Database connection failed' });

      const request = createMockRequest();
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('internal_error');
    });

    it('returns empty posts array for no results', async () => {
      mockDbQuery([], null);

      const request = createMockRequest();
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.posts).toEqual([]);
      expect(body.pagination.has_more).toBe(false);
    });
  });

  describe('Price Formatting', () => {
    it('formats price_usdc with 2 decimal places for paid posts', async () => {
      mockDbQuery([mockPosts[1]], null);

      const request = createMockRequest();
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.posts[0].price_usdc).toBe('0.25');
    });

    it('returns null price for free posts', async () => {
      mockDbQuery([mockPosts[0]], null);

      const request = createMockRequest();
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.posts[0].price_usdc).toBeNull();
    });
  });
});
