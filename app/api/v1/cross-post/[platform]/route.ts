/**
 * DELETE /api/v1/cross-post/[platform]
 *
 * Remove cross-posting configuration for a specific platform.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { deleteConfig } from '@/lib/cross-post';
import { createErrorResponse, ErrorCodes } from '@/types/api';
import { platformSchema } from '@/lib/validators/cross-post';

interface RouteParams {
  params: Promise<{ platform: string }>;
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  return withAuth(request, async (req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      const { platform: platformParam } = await params;

      // Validate platform parameter
      const validation = platformSchema.safeParse(platformParam);
      if (!validation.success) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INVALID_REQUEST_BODY,
            `Invalid platform: ${platformParam}. Supported platforms: moltbook`
          ),
          { status: 400 }
        );
      }

      const platform = validation.data;

      // Delete configuration
      const result = await deleteConfig(agent.id, platform);

      if (!result.success) {
        if (result.error === 'Configuration not found') {
          return NextResponse.json(
            createErrorResponse(
              ErrorCodes.NOT_FOUND,
              `No ${platform} configuration found`
            ),
            { status: 404 }
          );
        }

        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            result.error || 'Failed to delete configuration'
          ),
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Cross-posting to ${platform} has been disabled`,
      });
    } catch (error) {
      console.error('Error in cross-post delete:', error);

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
