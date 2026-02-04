/**
 * POST /api/v1/agents/rotate-key
 *
 * Rotates the authenticated agent's API key.
 *
 * IMPORTANT: The new API key is returned ONCE. The old key stops working
 * immediately after this call succeeds.
 *
 * Request Headers:
 *   Authorization: Bearer csk_live_xxxxx (current API key)
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "api_key": "csk_live_newkey...",  // New key - only returned once!
 *   "rotated_at": "2026-02-03T10:00:00Z"
 * }
 *
 * Errors:
 * - 401: Invalid or missing API key
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { generateApiKey, hashApiKey } from '@/lib/auth/api-key';
import { createErrorResponse, ErrorCodes } from '@/types/api';

/**
 * Response schema for successful key rotation
 */
interface RotateKeyResponse {
  success: true;
  api_key: string;
  rotated_at: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  return withAuth(request, async (_req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      // Generate new API key
      const newApiKey = generateApiKey('live');
      const newApiKeyHash = await hashApiKey(newApiKey);
      const rotatedAt = new Date().toISOString();

      // Update agent's API key hash in database
      const { error: dbError } = await supabaseAdmin
        .from('agents')
        .update({
          api_key_hash: newApiKeyHash,
          updated_at: rotatedAt,
        })
        .eq('id', agent.id);

      if (dbError) {
        console.error('Database error during key rotation:', dbError);
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            'Failed to rotate API key. Please try again.'
          ),
          { status: 500 }
        );
      }

      // Return new key (returned ONCE - old key is now invalid)
      const response: RotateKeyResponse = {
        success: true,
        api_key: newApiKey,
        rotated_at: rotatedAt,
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      console.error('Unexpected error during key rotation:', error);
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
