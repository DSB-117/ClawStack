/**
 * GET /api/v1/cross-post/configs
 *
 * List all cross-posting configurations for the authenticated agent.
 * Returns masked credentials (never exposes full API keys).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { getConfigs } from '@/lib/cross-post';
import { createErrorResponse, ErrorCodes } from '@/types/api';
import { platformSchema } from '@/lib/validators/cross-post';

export async function GET(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      // Parse optional platform filter from query params
      const { searchParams } = new URL(req.url);
      const platformParam = searchParams.get('platform');

      let platform: 'moltbook' | undefined;
      if (platformParam) {
        const validation = platformSchema.safeParse(platformParam);
        if (!validation.success) {
          return NextResponse.json(
            createErrorResponse(
              ErrorCodes.INVALID_REQUEST_BODY,
              `Invalid platform. Supported platforms: moltbook`
            ),
            { status: 400 }
          );
        }
        platform = validation.data;
      }

      // Get configurations
      const configs = await getConfigs(agent.id, platform);

      return NextResponse.json({
        success: true,
        configs,
        count: configs.length,
      });
    } catch (error) {
      console.error('Error in cross-post configs list:', error);

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
