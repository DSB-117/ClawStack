/**
 * Publish Endpoint Tests
 *
 * Tests for POST /api/v1/publish
 *
 * @see app/api/v1/publish/route.ts
 * @see claude/operations/tasks.md Task 1.4.11
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import * as authMiddleware from '@/lib/auth/middleware';
import * as supabaseModule from '@/lib/db/supabase-server';
import * as contentModule from '@/lib/content';

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

// Mock content utilities (to isolate tests)
jest.mock('@/lib/content', () => ({
  sanitizeContent: jest.fn((content: string) => content),
  generateSummary: jest.fn((content: string) => content.slice(0, 50)),
  generateSlug: jest.fn((title: string, id: string) => `${title.toLowerCase().replace(/\s+/g, '-')}-${id.slice(0, 8)}`),
}));

describe('POST /api/v1/publish', () => {
  const mockAgent = {
    id: 'agent-123-test',
    display_name: 'TestAgent',
    reputation_tier: 'established' as const,
  };

  // Helper to create mock requests
  function createMockRequest(body: unknown): NextRequest {
    return {
      json: jest.fn().mockResolvedValue(body),
      headers: new Headers({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer csk_live_testkey12345678901234567890ab',
      }),
    } as unknown as NextRequest;
  }

  // Helper to mock auth middleware
  function mockAuth(handler: authMiddleware.AuthenticatedHandler) {
    (authMiddleware.withAuth as jest.Mock).mockImplementation(
      async (request: NextRequest, handlerFn: authMiddleware.AuthenticatedHandler) => {
        return handlerFn(request, mockAgent);
      }
    );
  }

  // Helper to mock database insert
  function mockDbInsert(
    result: { id: string; title: string; published_at: string } | null,
    error: { message: string; code?: string } | null
  ) {
    const singleMock = jest.fn().mockResolvedValue({
      data: result,
      error,
    });

    const selectMock = jest.fn().mockReturnValue({
      single: singleMock,
    });

    const insertMock = jest.fn().mockReturnValue({
      select: selectMock,
    });

    (supabaseModule.supabaseAdmin.from as jest.Mock).mockReturnValue({
      insert: insertMock,
    });

    return { insertMock, selectMock, singleMock };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth(async () => NextResponse.json({ success: true }));
  });

  describe('Valid Free Post', () => {
    it('returns 201 for valid free post', async () => {
      const mockPost = {
        id: 'post-abc12345-6789',
        title: 'Test Post',
        published_at: '2026-02-03T10:00:00.000Z',
      };
      mockDbInsert(mockPost, null);

      const request = createMockRequest({
        title: 'Test Post',
        content: 'Hello World!',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.post.id).toBe(mockPost.id);
      expect(body.post.title).toBe(mockPost.title);
      expect(body.post.is_paid).toBe(false);
      expect(body.post.price_usdc).toBeNull();
      expect(body.post.slug).toContain('test-post');
      expect(body.post.url).toContain('/p/');
    });
  });

  describe('Valid Paid Post', () => {
    it('returns 201 for valid paid post with price', async () => {
      const mockPost = {
        id: 'post-def45678-9012',
        title: 'Premium Content',
        published_at: '2026-02-03T11:00:00.000Z',
      };
      mockDbInsert(mockPost, null);

      const request = createMockRequest({
        title: 'Premium Content',
        content: 'Valuable insights...',
        is_paid: true,
        price_usdc: '0.25',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.post.is_paid).toBe(true);
      expect(body.post.price_usdc).toBe('0.25');
    });
  });

  describe('Validation Errors', () => {
    it('returns 400 for missing title', async () => {
      const request = createMockRequest({
        content: 'No title provided',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.validation_errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'title' }),
        ])
      );
    });

    it('returns 400 for empty title', async () => {
      const request = createMockRequest({
        title: '',
        content: 'Has content but no title',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    it('returns 400 for title too long (201 chars)', async () => {
      const longTitle = 'a'.repeat(201);
      const request = createMockRequest({
        title: longTitle,
        content: 'Some content',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.validation_errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            message: expect.stringContaining('200'),
          }),
        ])
      );
    });

    it('returns 400 for paid post without price', async () => {
      const request = createMockRequest({
        title: 'Paid Post',
        content: 'Premium content',
        is_paid: true,
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.validation_errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'price_usdc',
            message: expect.stringContaining('required'),
          }),
        ])
      );
    });

    it('returns 400 for price below minimum (0.04)', async () => {
      const request = createMockRequest({
        title: 'Cheap Post',
        content: 'Too cheap',
        is_paid: true,
        price_usdc: '0.04',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.validation_errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'price_usdc',
            message: expect.stringContaining('0.05'),
          }),
        ])
      );
    });

    it('returns 400 for price above maximum (1.00)', async () => {
      const request = createMockRequest({
        title: 'Expensive Post',
        content: 'Too expensive',
        is_paid: true,
        price_usdc: '1.00',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.validation_errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'price_usdc',
            message: expect.stringContaining('0.99'),
          }),
        ])
      );
    });

    it('returns 400 for too many tags (6)', async () => {
      const request = createMockRequest({
        title: 'Tagged Post',
        content: 'With many tags',
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'],
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
      expect(body.validation_errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'tags',
            message: expect.stringContaining('5'),
          }),
        ])
      );
    });
  });

  describe('Content Sanitization', () => {
    it('calls sanitizeContent on input', async () => {
      const mockPost = {
        id: 'post-xyz12345',
        title: 'XSS Test',
        published_at: '2026-02-03T12:00:00.000Z',
      };
      mockDbInsert(mockPost, null);

      const xssContent = '<script>alert("xss")</script>Safe content';
      const request = createMockRequest({
        title: 'XSS Test',
        content: xssContent,
      });

      await POST(request);

      expect(contentModule.sanitizeContent).toHaveBeenCalledWith(xssContent);
    });
  });

  describe('Database Errors', () => {
    it('returns 500 for database errors', async () => {
      mockDbInsert(null, { message: 'Database connection failed' });

      const request = createMockRequest({
        title: 'DB Error Post',
        content: 'Will fail',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('internal_error');
    });
  });
});
