/**
 * POST /api/v1/cross-post/test/[platform]
 *
 * Test credentials for a platform without saving them.
 * Useful for validating API keys before configuring cross-posting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { testMoltbookCredentials } from '@/lib/cross-post';
import { testCredentialsRequestSchema, platformSchema } from '@/lib/validators/cross-post';
import {
  formatZodErrors,
  createErrorResponse,
  ErrorCodes,
} from '@/types/api';

interface RouteParams {
  params: Promise<{ platform: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  return withAuth(request, async (req: NextRequest, _agent: AuthenticatedAgent) => {
    try {
      const { platform: platformParam } = await params;

      // Validate platform parameter
      const platformValidation = platformSchema.safeParse(platformParam);
      if (!platformValidation.success) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INVALID_REQUEST_BODY,
            `Invalid platform: ${platformParam}. Supported platforms: moltbook`
          ),
          { status: 400 }
        );
      }

      const platform = platformValidation.data;

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

      // Add platform to body for validation
      const bodyWithPlatform = { ...body as object, platform };

      // Validate request
      const validation = testCredentialsRequestSchema.safeParse(bodyWithPlatform);

      if (!validation.success) {
        return NextResponse.json(formatZodErrors(validation.error), {
          status: 400,
        });
      }

      const { credentials, config } = validation.data;

      // Test credentials based on platform
      let testResult: { success: boolean; message: string; error_code?: string };

      switch (platform) {
        case 'moltbook':
          testResult = await testMoltbookCredentials(credentials, config);
          break;

        default:
          testResult = {
            success: false,
            message: `Testing not supported for platform: ${platform}`,
            error_code: 'UNSUPPORTED',
          };
      }

      if (testResult.success) {
        return NextResponse.json({
          success: true,
          message: testResult.message,
          platform,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: testResult.message,
          error_code: testResult.error_code,
          platform,
        },
        { status: 400 }
      );
    } catch (error) {
      console.error('Error in cross-post test:', error);

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
