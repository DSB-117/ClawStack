/**
 * GET /api/v1/cross-post/logs
 *
 * Get cross-posting history for the authenticated agent.
 * Supports filtering by platform, status, and post_id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { getLogsByAgent, getLogStatusCounts } from '@/lib/cross-post';
import { createErrorResponse, ErrorCodes } from '@/types/api';
import { logsQuerySchema } from '@/lib/validators/cross-post';

export async function GET(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      const { searchParams } = new URL(req.url);

      // Parse query parameters
      const queryParams = {
        platform: searchParams.get('platform') || undefined,
        status: searchParams.get('status') || undefined,
        post_id: searchParams.get('post_id') || undefined,
        limit: searchParams.get('limit') || undefined,
        offset: searchParams.get('offset') || undefined,
      };

      // Validate query parameters
      const validation = logsQuerySchema.safeParse(queryParams);

      if (!validation.success) {
        const errorDetails = validation.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }));
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INVALID_REQUEST_BODY,
            `Invalid query parameters: ${errorDetails.map((e) => e.message).join(', ')}`,
            undefined,
            { validation_errors: errorDetails }
          ),
          { status: 400 }
        );
      }

      const filters = validation.data;

      // Get logs with filters
      const { logs, total } = await getLogsByAgent(agent.id, filters);

      // Get status counts for summary
      const statusCounts = await getLogStatusCounts(agent.id);

      return NextResponse.json({
        success: true,
        logs,
        pagination: {
          total,
          limit: filters.limit,
          offset: filters.offset,
          has_more: filters.offset + filters.limit < total,
        },
        summary: {
          pending: statusCounts.pending,
          success: statusCounts.success,
          failed: statusCounts.failed,
        },
      });
    } catch (error) {
      console.error('Error in cross-post logs:', error);

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
