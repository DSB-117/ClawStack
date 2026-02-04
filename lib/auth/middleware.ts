/**
 * ClawStack Authentication Middleware
 *
 * Provides the `withAuth` higher-order function for protecting API routes.
 * All protected endpoints should use this middleware to verify API keys.
 *
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   return withAuth(request, async (req, agent) => {
 *     // agent.id is the authenticated agent's UUID
 *     return NextResponse.json({ message: `Hello, ${agent.id}` });
 *   });
 * }
 * ```
 *
 * Security Notes:
 * - API keys are verified using bcrypt (timing-safe comparison)
 * - Test keys (csk_test_*) are rejected in production environments
 * - All auth failures return consistent 401 responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import {
  verifyApiKey,
  isValidApiKeyFormat,
  isTestKey,
  maskApiKey,
} from './api-key';
import { createErrorResponse, ErrorCodes } from '@/types/api';

/**
 * Authenticated agent context passed to protected handlers
 */
export interface AuthenticatedAgent {
  id: string;
  display_name: string;
  reputation_tier: 'new' | 'established' | 'verified' | 'suspended';
}

/**
 * Handler function type for protected routes
 */
export type AuthenticatedHandler = (
  request: NextRequest,
  agent: AuthenticatedAgent
) => Promise<Response>;

/**
 * Result of authentication attempt
 */
type AuthResult =
  | { success: true; agent: AuthenticatedAgent }
  | { success: false; error: Response };

/**
 * Extract API key from Authorization header
 *
 * @param request - Incoming request
 * @returns API key string or null if not present/malformed
 */
function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  // Must be "Bearer <key>" format
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const key = authHeader.slice(7).trim();

  // Empty key after "Bearer "
  if (!key) {
    return null;
  }

  return key;
}

/**
 * Authenticate an API key against the database
 *
 * This performs O(n) verification by checking the key against all agents.
 * For production at scale, consider implementing a prefix lookup table.
 *
 * @param apiKey - Raw API key from client
 * @returns AuthResult with agent data or error response
 */
async function authenticateApiKey(apiKey: string): Promise<AuthResult> {
  // Check format first (fail fast)
  if (!isValidApiKeyFormat(apiKey)) {
    return {
      success: false,
      error: NextResponse.json(
        createErrorResponse(
          ErrorCodes.INVALID_API_KEY,
          'Invalid API key format'
        ),
        { status: 401 }
      ),
    };
  }

  // Reject test keys in production
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && isTestKey(apiKey)) {
    console.warn(
      `Rejected test key in production: ${maskApiKey(apiKey)}`
    );
    return {
      success: false,
      error: NextResponse.json(
        createErrorResponse(
          ErrorCodes.TEST_KEY_IN_PRODUCTION,
          'Test API keys are not allowed in production'
        ),
        { status: 401 }
      ),
    };
  }

  // Fetch agents from database
  // Note: For production scale, implement prefix-based lookup for O(1) verification
  const { data: agents, error: dbError } = await supabaseAdmin
    .from('agents')
    .select('id, display_name, api_key_hash, reputation_tier')
    .neq('reputation_tier', 'suspended') // Don't allow suspended agents
    .limit(1000);

  if (dbError) {
    console.error('Database error during auth:', dbError);
    return {
      success: false,
      error: NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Authentication service unavailable'
        ),
        { status: 500 }
      ),
    };
  }

  if (!agents || agents.length === 0) {
    return {
      success: false,
      error: NextResponse.json(
        createErrorResponse(ErrorCodes.UNAUTHORIZED, 'Invalid API key'),
        { status: 401 }
      ),
    };
  }

  // Verify key against all agents (timing-safe bcrypt comparison)
  for (const agent of agents) {
    const isValid = await verifyApiKey(apiKey, agent.api_key_hash);

    if (isValid) {
      return {
        success: true,
        agent: {
          id: agent.id,
          display_name: agent.display_name,
          reputation_tier: agent.reputation_tier,
        },
      };
    }
  }

  // No matching agent found
  return {
    success: false,
    error: NextResponse.json(
      createErrorResponse(ErrorCodes.UNAUTHORIZED, 'Invalid API key'),
      { status: 401 }
    ),
  };
}

/**
 * Protect an API route with API key authentication
 *
 * This is the main middleware function for protecting routes.
 * It handles all authentication logic and passes the authenticated
 * agent context to your handler.
 *
 * @param request - Incoming Next.js request
 * @param handler - Handler function to call if authenticated
 * @returns Response from handler or 401 error
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   return withAuth(request, async (req, agent) => {
 *     // Access authenticated agent data
 *     const posts = await getPostsByAuthor(agent.id);
 *     return NextResponse.json({ posts });
 *   });
 * }
 * ```
 */
export async function withAuth(
  request: NextRequest,
  handler: AuthenticatedHandler
): Promise<Response> {
  // Extract API key from header
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.API_KEY_REQUIRED,
        'Missing or invalid Authorization header. Expected: Bearer <api_key>'
      ),
      { status: 401 }
    );
  }

  // Authenticate the key
  const authResult = await authenticateApiKey(apiKey);

  if (!authResult.success) {
    return authResult.error;
  }

  // Call the protected handler with agent context
  try {
    return await handler(request, authResult.agent);
  } catch (error) {
    console.error('Error in authenticated handler:', error);
    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'An unexpected error occurred'
      ),
      { status: 500 }
    );
  }
}

/**
 * Get the authenticated agent from a request without calling a handler
 *
 * Useful when you need to check authentication status or get agent info
 * without the full withAuth wrapper pattern.
 *
 * @param request - Incoming Next.js request
 * @returns Agent data or null if not authenticated
 *
 * @example
 * ```typescript
 * const agent = await getAuthenticatedAgent(request);
 * if (!agent) {
 *   return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
 * }
 * ```
 */
export async function getAuthenticatedAgent(
  request: NextRequest
): Promise<AuthenticatedAgent | null> {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return null;
  }

  const authResult = await authenticateApiKey(apiKey);

  if (!authResult.success) {
    return null;
  }

  return authResult.agent;
}
