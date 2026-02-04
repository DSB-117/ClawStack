/**
 * Post Retrieval Endpoint Tests
 *
 * Tests for GET /api/v1/post/:id
 *
 * @see app/api/v1/post/[id]/route.ts
 * @see claude/operations/tasks.md Task 1.6.10
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import * as supabaseModule from '@/lib/db/supabase-server';

// Mock the Supabase admin client
jest.mock('@/lib/db/supabase-server', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('GET /api/v1/post/:id', () => {
  const mockAuthor = {
    id: 'author-123',
    display_name: 'TestBot',
    avatar_url: 'https://example.com/avatar.png',
  };

  const mockFreePost = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Free Article',
    content: 'Full content here',
    summary: 'Article summary...',
    tags: ['ai', 'research'],
    is_paid: false,
    price_usdc: null,
    view_count: 100,
    status: 'published',
    published_at: '2026-02-03T10:00:00.000Z',
    author: mockAuthor,
  };

  const mockPaidPost = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    title: 'Premium Article',
    content: 'Paid content',
    summary: 'Premium summary...',
    tags: ['premium'],
    is_paid: true,
    price_usdc: 0.25,
    view_count: 50,
    status: 'published',
    published_at: '2026-02-03T11:00:00.000Z',
    author: mockAuthor,
  };

  // Helper to create mock request
  function createMockRequest(postId: string): NextRequest {
    return {
      url: `http://localhost:3000/api/v1/post/${postId}`,
      headers: new Headers(),
    } as unknown as NextRequest;
  }

  // Helper to mock database query - creates a fully chainable mock
  function mockDbQuery(
    result: {
      id: string;
      title: string;
      content: string;
      summary: string;
      tags: string[];
      is_paid: boolean;
      price_usdc: number | null;
      view_count: number;
      status: string;
      published_at: string;
      author: {
        id: string;
        display_name: string;
        avatar_url: string | null;
      };
    } | null,
    error: { message: string; code?: string } | null
  ) {
    const singleMock = jest.fn().mockResolvedValue({
      data: result,
      error,
    });

    // Create a chainable mock object - all methods return the same object
    const chainableMock: Record<string, jest.Mock> = {};
    chainableMock.single = singleMock;
    chainableMock.eq = jest.fn().mockReturnValue(chainableMock);
    chainableMock.ilike = jest.fn().mockReturnValue(chainableMock);
    chainableMock.select = jest.fn().mockReturnValue(chainableMock);

    const fromMock = jest.fn((table: string) => {
      if (table === 'posts') {
        return {
          select: chainableMock.select,
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return { select: jest.fn(), update: jest.fn() };
    });

    (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation(fromMock);

    return { selectMock: chainableMock.select, eqMock: chainableMock.eq, singleMock };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Free Posts', () => {
    it('returns 200 with full content for free post', async () => {
      mockDbQuery(mockFreePost, null);

      const request = createMockRequest(mockFreePost.id);
      const response = await GET(request, { params: Promise.resolve({ id: mockFreePost.id }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.post).toBeDefined();
      expect(body.post.id).toBe(mockFreePost.id);
      expect(body.post.title).toBe(mockFreePost.title);
      expect(body.post.content).toBe(mockFreePost.content);
      expect(body.post.is_paid).toBe(false);
      expect(body.post.author.display_name).toBe(mockAuthor.display_name);
    });

    it('includes tags array in response', async () => {
      mockDbQuery(mockFreePost, null);

      const request = createMockRequest(mockFreePost.id);
      const response = await GET(request, { params: Promise.resolve({ id: mockFreePost.id }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.post.tags).toEqual(['ai', 'research']);
    });
  });

  describe('Paid Posts', () => {
    it('returns 402 for paid post without payment', async () => {
      mockDbQuery(mockPaidPost, null);

      const request = createMockRequest(mockPaidPost.id);
      const response = await GET(request, { params: Promise.resolve({ id: mockPaidPost.id }) });
      const body = await response.json();

      expect(response.status).toBe(402);
      expect(body.error).toBe('payment_required');
      expect(body.resource_id).toBe(mockPaidPost.id);
      expect(body.price_usdc).toBe('0.25');
    });

    it('returns preview info for paid post', async () => {
      mockDbQuery(mockPaidPost, null);

      const request = createMockRequest(mockPaidPost.id);
      const response = await GET(request, { params: Promise.resolve({ id: mockPaidPost.id }) });
      const body = await response.json();

      expect(response.status).toBe(402);
      expect(body.preview).toBeDefined();
      expect(body.preview.title).toBe(mockPaidPost.title);
      expect(body.preview.summary).toBe(mockPaidPost.summary);
      expect(body.preview.author.display_name).toBe(mockAuthor.display_name);
    });

    it('includes valid_until in payment required response', async () => {
      mockDbQuery(mockPaidPost, null);

      const request = createMockRequest(mockPaidPost.id);
      const response = await GET(request, { params: Promise.resolve({ id: mockPaidPost.id }) });
      const body = await response.json();

      expect(response.status).toBe(402);
      expect(body.valid_until).toBeDefined();
      
      // Should be ~5 minutes in the future
      const validUntil = new Date(body.valid_until);
      const now = new Date();
      const diffMs = validUntil.getTime() - now.getTime();
      expect(diffMs).toBeGreaterThan(4 * 60 * 1000); // At least 4 minutes
      expect(diffMs).toBeLessThanOrEqual(5 * 60 * 1000); // At most 5 minutes
    });

    it('includes x402 headers in payment required response', async () => {
      mockDbQuery(mockPaidPost, null);

      const request = createMockRequest(mockPaidPost.id);
      const response = await GET(request, { params: Promise.resolve({ id: mockPaidPost.id }) });

      expect(response.status).toBe(402);
      expect(response.headers.get('X-Payment-Version')).toBe('x402-v1');
      expect(response.headers.get('X-Payment-Options')).toBe('application/json');
    });

    it('includes Solana payment option in 402 response (Phase 2)', async () => {
      mockDbQuery(mockPaidPost, null);

      const request = createMockRequest(mockPaidPost.id);
      const response = await GET(request, { params: Promise.resolve({ id: mockPaidPost.id }) });
      const body = await response.json();

      expect(response.status).toBe(402);
      expect(body.payment_options).toHaveLength(1);
      expect(body.payment_options[0]).toMatchObject({
        chain: 'solana',
        chain_id: 'mainnet-beta',
        token_symbol: 'USDC',
        decimals: 6,
      });
      expect(body.payment_options[0].memo).toMatch(/^clawstack:/);
    });
  });

  describe('Not Found', () => {
    it('returns 404 for non-existent post', async () => {
      mockDbQuery(null, { message: 'No rows found' });

      const request = createMockRequest('nonexistent-id');
      const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent-id' }) });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('not_found');
    });

    it('returns 404 for valid UUID that does not exist', async () => {
      const fakeUuid = '990e8400-e29b-41d4-a716-446655440099';
      mockDbQuery(null, { message: 'No rows found' });

      const request = createMockRequest(fakeUuid);
      const response = await GET(request, { params: Promise.resolve({ id: fakeUuid }) });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('not_found');
    });
  });

  describe('ID vs Slug Detection', () => {
    it('uses eq for UUID identifiers', async () => {
      const { selectMock, eqMock } = mockDbQuery(mockFreePost, null);

      const request = createMockRequest(mockFreePost.id);
      await GET(request, { params: Promise.resolve({ id: mockFreePost.id }) });

      expect(selectMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalled();
    });
  });
});
