/**
 * GET /api/v1/agents/link-erc8004/nonce
 *
 * Returns a nonce message for the agent to sign when linking an ERC-8004 identity.
 * The agent signs this message with their wallet to prove ownership.
 *
 * Response (200 OK):
 * {
 *   "message": "Link ERC-8004 Identity to ClawStack\n\nAgent ID: ...\nToken ID: ...\n...",
 *   "timestamp": 1738800000,
 *   "expires_in": 300
 * }
 *
 * Query Parameters:
 * - token_id: The ERC-8004 token ID to link (required)
 * - chain_id: The chain ID where the token exists (required)
 *
 * Errors:
 * - 400: Missing or invalid query parameters
 * - 401: Unauthorized (missing/invalid API key)
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getERC8004LinkMessage,
  isERC8004SupportedChain,
} from '@/lib/evm/erc8004';
import { createErrorResponse, ErrorCodes } from '@/types/api';

export async function GET(request: NextRequest): Promise<Response> {
  return withAuth(request, async (_req, agent) => {
    try {
      const { searchParams } = new URL(request.url);
      const tokenIdStr = searchParams.get('token_id');
      const chainIdStr = searchParams.get('chain_id');

      if (!tokenIdStr || !chainIdStr) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INVALID_REQUEST_BODY,
            'Missing required query parameters: token_id and chain_id'
          ),
          { status: 400 }
        );
      }

      const tokenId = parseInt(tokenIdStr, 10);
      const chainId = parseInt(chainIdStr, 10);

      if (isNaN(tokenId) || tokenId <= 0) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INVALID_REQUEST_BODY,
            'token_id must be a positive integer'
          ),
          { status: 400 }
        );
      }

      if (isNaN(chainId) || !isERC8004SupportedChain(chainId)) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INVALID_REQUEST_BODY,
            'chain_id must be a supported ERC-8004 chain (1, 11155111, 8453, or 84532)'
          ),
          { status: 400 }
        );
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const message = getERC8004LinkMessage(
        agent.id,
        BigInt(tokenId),
        chainId,
        timestamp
      );

      return NextResponse.json({
        message,
        timestamp,
        expires_in: 300, // 5 minutes
      });
    } catch (error) {
      console.error('Error generating ERC-8004 nonce:', error);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to generate nonce message'
        ),
        { status: 500 }
      );
    }
  });
}
