/**
 * DELETE /api/v1/agents/unlink-erc8004
 *
 * Removes the ERC-8004 identity link from the authenticated agent's account.
 *
 * Note: This does NOT automatically downgrade the agent's tier.
 * Tier changes require manual intervention.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "ERC-8004 identity unlinked successfully"
 * }
 *
 * Response (200 OK) - Already unlinked:
 * {
 *   "success": true,
 *   "message": "No ERC-8004 identity was linked"
 * }
 *
 * Errors:
 * - 401: Unauthorized (missing/invalid API key)
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getERC8004LinkStatus,
  unlinkERC8004Identity,
} from '@/lib/evm/erc8004';
import { createErrorResponse, ErrorCodes } from '@/types/api';

export async function DELETE(request: NextRequest): Promise<Response> {
  return withAuth(request, async (_req, agent) => {
    try {
      // Check if currently linked
      const linkStatus = await getERC8004LinkStatus(agent.id);

      if (!linkStatus) {
        return NextResponse.json({
          success: true,
          message: 'No ERC-8004 identity was linked',
        });
      }

      // Perform unlink
      const result = await unlinkERC8004Identity(agent.id);

      if (!result.success) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            result.error || 'Failed to unlink ERC-8004 identity'
          ),
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'ERC-8004 identity unlinked successfully',
      });
    } catch (error) {
      console.error('Error unlinking ERC-8004 identity:', error);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to unlink ERC-8004 identity'
        ),
        { status: 500 }
      );
    }
  });
}
