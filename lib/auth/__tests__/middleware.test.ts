/**
 * Auth Middleware Tests
 *
 * Tests for the withAuth middleware function.
 *
 * @see lib/auth/middleware.ts
 * @see claude/operations/tasks.md Task 1.3.8
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getAuthenticatedAgent } from '../middleware';
import * as apiKeyModule from '../api-key';
import * as supabaseModule from '@/lib/db/supabase-server';

// Mock the Supabase admin client
jest.mock('@/lib/db/supabase-server', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

// Mock api-key module for controlled test behavior
jest.mock('../api-key', () => ({
  ...jest.requireActual('../api-key'),
  verifyApiKey: jest.fn(),
  isValidApiKeyFormat: jest.fn(),
  isTestKey: jest.fn(),
  maskApiKey: jest.fn().mockReturnValue('[masked]'),
}));

describe('Auth Middleware', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    (apiKeyModule.isValidApiKeyFormat as jest.Mock).mockReturnValue(true);
    (apiKeyModule.isTestKey as jest.Mock).mockReturnValue(false);
  });

  /**
   * Helper to create mock requests
   */
  function createMockRequest(options: {
    authorization?: string;
    method?: string;
    url?: string;
  }): NextRequest {
    const headers = new Headers();
    if (options.authorization) {
      headers.set('Authorization', options.authorization);
    }

    return {
      headers,
      method: options.method || 'GET',
      url: options.url || 'http://localhost:3000/api/test',
    } as unknown as NextRequest;
  }

  /**
   * Mock Supabase response
   */
  function mockSupabaseAgents(agents: Array<{
    id: string;
    display_name: string;
    api_key_hash: string;
    reputation_tier: string;
  }> | null, error?: { message: string; code?: string }) {
    const selectMock = jest.fn().mockReturnValue({
      neq: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({
          data: agents,
          error: error || null,
        }),
      }),
    });

    (supabaseModule.supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: selectMock,
    });
  }

  describe('withAuth', () => {
    describe('Missing Authorization Header', () => {
      it('returns 401 when Authorization header is missing', async () => {
        const request = createMockRequest({});
        const handler = jest.fn();

        const response = await withAuth(request, handler);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('api_key_required');
        expect(body.message).toContain('Missing or invalid Authorization header');
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('Invalid Header Format', () => {
      it('returns 401 when Authorization header has no "Bearer " prefix', async () => {
        const request = createMockRequest({
          authorization: 'csk_live_testkey12345678901234567890ab',
        });
        const handler = jest.fn();

        const response = await withAuth(request, handler);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('api_key_required');
        expect(handler).not.toHaveBeenCalled();
      });

      it('returns 401 when Authorization header has empty Bearer token', async () => {
        const request = createMockRequest({
          authorization: 'Bearer ',
        });
        const handler = jest.fn();

        const response = await withAuth(request, handler);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('api_key_required');
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('Invalid API Key', () => {
      it('returns 401 for invalid API key format', async () => {
        (apiKeyModule.isValidApiKeyFormat as jest.Mock).mockReturnValue(false);

        const request = createMockRequest({
          authorization: 'Bearer invalid_key_format',
        });
        const handler = jest.fn();

        const response = await withAuth(request, handler);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('invalid_api_key');
        expect(handler).not.toHaveBeenCalled();
      });

      it('returns 401 when API key does not match any agent', async () => {
        mockSupabaseAgents([
          {
            id: 'agent-123',
            display_name: 'TestAgent',
            api_key_hash: '$2b$10$hashedkey...',
            reputation_tier: 'established',
          },
        ]);
        (apiKeyModule.verifyApiKey as jest.Mock).mockResolvedValue(false);

        const request = createMockRequest({
          authorization: 'Bearer csk_live_wrongkey1234567890123456789012',
        });
        const handler = jest.fn();

        const response = await withAuth(request, handler);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('unauthorized');
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('Valid API Key', () => {
      it('calls handler with correct agent context when API key is valid', async () => {
        const testAgent = {
          id: 'agent-456',
          display_name: 'ValidAgent',
          api_key_hash: '$2b$10$validhash...',
          reputation_tier: 'verified',
        };

        mockSupabaseAgents([testAgent]);
        (apiKeyModule.verifyApiKey as jest.Mock).mockResolvedValue(true);

        const request = createMockRequest({
          authorization: 'Bearer csk_live_validkey123456789012345678901',
        });
        const handler = jest.fn().mockResolvedValue(
          NextResponse.json({ success: true })
        );

        const response = await withAuth(request, handler);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(request, {
          id: testAgent.id,
          display_name: testAgent.display_name,
          reputation_tier: testAgent.reputation_tier,
        });
      });
    });

    describe('Test Key in Production', () => {
      it('returns 401 when using test key in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: 'production',
          writable: true,
        });

        (apiKeyModule.isTestKey as jest.Mock).mockReturnValue(true);

        const request = createMockRequest({
          authorization: 'Bearer csk_test_testkey12345678901234567890',
        });
        const handler = jest.fn();

        const response = await withAuth(request, handler);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('test_key_in_production');
        expect(handler).not.toHaveBeenCalled();

        Object.defineProperty(process.env, 'NODE_ENV', {
          value: originalEnv,
          writable: true,
        });
      });
    });

    describe('Database Errors', () => {
      it('returns 500 when database query fails', async () => {
        mockSupabaseAgents(null, { message: 'Database connection failed' });

        const request = createMockRequest({
          authorization: 'Bearer csk_live_validkey123456789012345678901',
        });
        const handler = jest.fn();

        const response = await withAuth(request, handler);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe('internal_error');
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('Handler Errors', () => {
      it('returns 500 when handler throws an error', async () => {
        const testAgent = {
          id: 'agent-789',
          display_name: 'ErrorAgent',
          api_key_hash: '$2b$10$hash...',
          reputation_tier: 'new',
        };

        mockSupabaseAgents([testAgent]);
        (apiKeyModule.verifyApiKey as jest.Mock).mockResolvedValue(true);

        const request = createMockRequest({
          authorization: 'Bearer csk_live_validkey123456789012345678901',
        });
        const handler = jest.fn().mockRejectedValue(new Error('Handler crashed'));

        const response = await withAuth(request, handler);
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe('internal_error');
      });
    });
  });

  describe('getAuthenticatedAgent', () => {
    it('returns null when no Authorization header', async () => {
      const request = createMockRequest({});

      const agent = await getAuthenticatedAgent(request);

      expect(agent).toBeNull();
    });

    it('returns agent when valid API key provided', async () => {
      const testAgent = {
        id: 'agent-abc',
        display_name: 'TestAgent',
        api_key_hash: '$2b$10$hash...',
        reputation_tier: 'established',
      };

      mockSupabaseAgents([testAgent]);
      (apiKeyModule.verifyApiKey as jest.Mock).mockResolvedValue(true);

      const request = createMockRequest({
        authorization: 'Bearer csk_live_validkey123456789012345678901',
      });

      const agent = await getAuthenticatedAgent(request);

      expect(agent).toEqual({
        id: testAgent.id,
        display_name: testAgent.display_name,
        reputation_tier: testAgent.reputation_tier,
      });
    });
  });
});
