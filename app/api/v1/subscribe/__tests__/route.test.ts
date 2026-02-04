/**
 * Subscription Endpoint Tests
 *
 * Tests for subscription CRUD operations:
 * - POST /api/v1/subscribe
 * - DELETE /api/v1/subscribe/:id
 * - PATCH /api/v1/subscribe/:id
 * - GET /api/v1/subscriptions
 *
 * @see app/api/v1/subscribe/route.ts
 * @see app/api/v1/subscribe/[id]/route.ts
 * @see app/api/v1/subscriptions/route.ts
 * @see claude/operations/tasks.md Task 4.1.8
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { DELETE, PATCH } from '../[id]/route';
import { GET } from '../../subscriptions/route';
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

describe('Subscription Endpoints', () => {
  const mockSubscriber = {
    id: 'subscriber-123',
    display_name: 'SubscriberAgent',
    reputation_tier: 'established' as const,
  };

  const mockAuthor = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    display_name: 'AuthorAgent',
  };

  const mockSubscription = {
    id: 'sub-789',
    subscriber_id: 'subscriber-123',
    author_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    payment_type: 'per_view',
    webhook_url: null,
    status: 'active',
    created_at: '2026-02-03T10:00:00.000Z',
    cancelled_at: null,
  };

  // Helper to create mock requests
  function createMockRequest(body?: unknown): NextRequest {
    return {
      json: jest.fn().mockResolvedValue(body || {}),
      headers: new Headers({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer csk_live_testkey12345678901234567890ab',
      }),
    } as unknown as NextRequest;
  }

  // Helper to mock auth middleware
  function mockAuth(agent = mockSubscriber) {
    (authMiddleware.withAuth as jest.Mock).mockImplementation(
      async (request: NextRequest, handlerFn: authMiddleware.AuthenticatedHandler) => {
        return handlerFn(request, agent);
      }
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth();
  });

  // ========================================================================
  // POST /api/v1/subscribe
  // ========================================================================

  describe('POST /api/v1/subscribe', () => {
    it('returns 201 for valid subscription', async () => {
      let callCount = 0;
      (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'agents') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAuthor,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'subscriptions') {
          callCount++;
          if (callCount === 1) {
            // Check for existing subscription
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: null,
                      error: { code: 'PGRST116' },
                    }),
                  }),
                }),
              }),
            };
          } else {
            // Insert subscription
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockSubscription,
                    error: null,
                  }),
                }),
              }),
            };
          }
        }
        return {};
      });

      const request = createMockRequest({
        author_id: mockAuthor.id,
        payment_type: 'per_view',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.subscription.author_id).toBe(mockAuthor.id);
    });

    it('returns 400 for missing author_id', async () => {
      const request = createMockRequest({
        payment_type: 'per_view',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    it('returns 400 for invalid payment_type', async () => {
      const request = createMockRequest({
        author_id: mockAuthor.id,
        payment_type: 'invalid',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    it('returns 400 for self-subscription', async () => {
      mockAuth({ ...mockSubscriber, id: mockAuthor.id });

      (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'agents') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAuthor,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const request = createMockRequest({
        author_id: mockAuthor.id,
        payment_type: 'per_view',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.message).toContain('yourself');
    });

    it('returns 404 when author not found', async () => {
      (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'agents') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' },
                }),
              }),
            }),
          };
        }
        return {};
      });

      const request = createMockRequest({
        author_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', // Valid UUID v4 format
        payment_type: 'per_view',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('not_found');
    });

    it('returns 409 for duplicate subscription', async () => {
      let callCount = 0;
      (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'agents') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAuthor,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'subscriptions') {
          callCount++;
          if (callCount === 1) {
            // Existing subscription found
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { id: 'existing-sub' },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
        }
        return {};
      });

      const request = createMockRequest({
        author_id: mockAuthor.id,
        payment_type: 'per_view',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe('already_exists');
    });

    it('returns 400 for invalid webhook_url', async () => {
      const request = createMockRequest({
        author_id: mockAuthor.id,
        payment_type: 'per_view',
        webhook_url: 'not-a-url',
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
    });
  });

  // ========================================================================
  // DELETE /api/v1/subscribe/:id
  // ========================================================================

  describe('DELETE /api/v1/subscribe/:id', () => {
    it('returns 200 for successful cancellation', async () => {
      let callCount = 0;
      (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Select subscription
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: mockSubscription.id,
                    subscriber_id: mockSubscriber.id,
                    status: 'active',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        // Update subscription
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                error: null,
              }),
            }),
          }),
        };
      });

      const request = createMockRequest();
      const response = await DELETE(request, { params: Promise.resolve({ id: mockSubscription.id }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('returns 404 when subscription not found', async () => {
      (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      }));

      const request = createMockRequest();
      const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('not_found');
    });

    it('returns 403 when not subscription owner', async () => {
      (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSubscription.id,
                subscriber_id: 'other-agent',
                status: 'active',
              },
              error: null,
            }),
          }),
        }),
      }));

      const request = createMockRequest();
      const response = await DELETE(request, { params: Promise.resolve({ id: mockSubscription.id }) });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBe('forbidden');
    });
  });

  // ========================================================================
  // PATCH /api/v1/subscribe/:id
  // ========================================================================

  describe('PATCH /api/v1/subscribe/:id', () => {
    it('returns 200 for successful status update', async () => {
      let callCount = 0;
      (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Select subscription
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: mockSubscription.id,
                    subscriber_id: mockSubscriber.id,
                    status: 'active',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        // Update subscription
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { ...mockSubscription, status: 'paused' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      });

      const request = createMockRequest({ status: 'paused' });
      const response = await PATCH(request, { params: Promise.resolve({ id: mockSubscription.id }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.subscription.status).toBe('paused');
    });

    it('returns 400 for invalid status', async () => {
      const request = createMockRequest({ status: 'cancelled' });
      const response = await PATCH(request, { params: Promise.resolve({ id: mockSubscription.id }) });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation_error');
    });

    it('returns 400 when updating cancelled subscription', async () => {
      (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockSubscription.id,
                subscriber_id: mockSubscriber.id,
                status: 'cancelled',
              },
              error: null,
            }),
          }),
        }),
      }));

      const request = createMockRequest({ status: 'active' });
      const response = await PATCH(request, { params: Promise.resolve({ id: mockSubscription.id }) });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.message).toContain('cancelled');
    });
  });

  // ========================================================================
  // GET /api/v1/subscriptions
  // ========================================================================

  describe('GET /api/v1/subscriptions', () => {
    it('returns 200 with empty list', async () => {
      (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }));

      const request = createMockRequest();
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.subscriptions).toEqual([]);
    });

    it('returns 200 with subscription list', async () => {
      const subs = [{
        ...mockSubscription,
        author: mockAuthor,
      }];

      (supabaseModule.supabaseAdmin.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: subs,
              error: null,
            }),
          }),
        }),
      }));

      const request = createMockRequest();
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.subscriptions).toHaveLength(1);
      expect(body.subscriptions[0].author.display_name).toBe(mockAuthor.display_name);
    });
  });
});
