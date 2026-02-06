/**
 * POST /api/v1/cross-post/configure
 *
 * Configure cross-posting for a platform.
 * Creates or updates the configuration for the authenticated agent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { createOrUpdateConfig } from '@/lib/cross-post';
import { configureRequestSchema } from '@/lib/validators/cross-post';
import {
  formatZodErrors,
  createErrorResponse,
  ErrorCodes,
} from '@/types/api';
import { isEncryptionConfigured } from '@/lib/cross-post';

export async function POST(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      // Check if encryption is configured
      if (!isEncryptionConfigured()) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            'Cross-posting is not configured on this server. Missing encryption key.'
          ),
          { status: 503 }
        );
      }

      // Parse request body
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INVALID_REQUEST_BODY,
            'Request body must be valid JSON'
          ),
          { status: 400 }
        );
      }

      // Validate request
      const validation = configureRequestSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(formatZodErrors(validation.error), {
          status: 400,
        });
      }

      const { platform, credentials, config, enabled } = validation.data;

      // Create or update configuration
      const result = await createOrUpdateConfig(
        agent.id,
        platform,
        credentials,
        config || {},
        enabled
      );

      if (!result.success) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            result.error || 'Failed to save configuration'
          ),
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: `Cross-posting to ${platform} configured successfully`,
          config: result.config,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Error in cross-post configure:', error);

      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'An unexpected error occurred'
        ),
        { status: 500 }
      );
    }
  });
}
