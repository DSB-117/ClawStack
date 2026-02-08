/**
 * POST /api/v1/agents/link-erc8004
 *
 * Links an ERC-8004 identity to the authenticated agent's account.
 * This enables the agent to benefit from on-chain reputation and
 * potentially upgrade to the 'verified' tier automatically.
 *
 * Request Body:
 * {
 *   "token_id": 123,                    // ERC-8004 token ID
 *   "chain_id": 8453,                   // Base (8453) or Base Sepolia (84532)
 *   "wallet_address": "0x...",          // Wallet that owns the token
 *   "signature": "0x...",               // Signed message proving ownership
 *   "message": "Link ERC-8004 Identity..."  // The signed message
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "verified": true,
 *   "tier_upgraded": true,
 *   "new_tier": "verified",
 *   "agent_uri": "https://..."
 * }
 *
 * Errors:
 * - 400: Validation error / Chain not supported
 * - 401: Unauthorized (missing/invalid API key)
 * - 403: Signature verification failed / Ownership verification failed
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import {
  linkERC8004Identity,
  isERC8004SupportedChain,
  type LinkERC8004Request,
} from '@/lib/evm/erc8004';
import {
  formatZodErrors,
  createErrorResponse,
  ErrorCodes,
} from '@/types/api';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from '@/lib/ratelimit';

/**
 * Request body schema
 */
const LinkERC8004Schema = z.object({
  token_id: z
    .number()
    .int()
    .positive('token_id must be a positive integer'),
  chain_id: z
    .number()
    .int()
    .refine(
      (val) => isERC8004SupportedChain(val),
      'chain_id must be 1 (Ethereum), 11155111 (Sepolia), 8453 (Base), or 84532 (Base Sepolia)'
    ),
  wallet_address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'wallet_address must be a valid EVM address'),
  signature: z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/, 'signature must be a valid hex string'),
  message: z
    .string()
    .min(1, 'message is required')
    .max(2000, 'message must be 2000 characters or less'),
});

export async function POST(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req, agent) => {
    // Rate limit: 5 link attempts per agent per hour
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(
      `erc8004-link:${agent.id}`,
      clientIp,
      5,
      '1 h'
    );

    if (rateLimitResult === null) {
      // Redis unavailable - allow in dev, block in prod
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.SERVICE_UNAVAILABLE,
            'Service temporarily unavailable'
          ),
          { status: 503 }
        );
      }
    } else if (!rateLimitResult.success) {
      const retryAfter = Math.ceil(
        (rateLimitResult.reset - Date.now()) / 1000
      );
      return createRateLimitResponse(retryAfter);
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

    // Validate request body
    const validation = LinkERC8004Schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(formatZodErrors(validation.error), {
        status: 400,
      });
    }

    const { token_id, chain_id, wallet_address, signature, message } =
      validation.data;

    // Prepare link request
    const linkRequest: LinkERC8004Request = {
      agentId: agent.id,
      tokenId: BigInt(token_id),
      chainId: chain_id,
      walletAddress: wallet_address as `0x${string}`,
      signature: signature as `0x${string}`,
      message,
    };

    // Perform linking
    const result = await linkERC8004Identity(linkRequest);

    if (!result.success) {
      // Determine appropriate status code based on error
      const status = result.error?.includes('signature')
        ? 403
        : result.error?.includes('ownership')
          ? 403
          : result.error?.includes('Chain')
            ? 400
            : 500;

      return NextResponse.json(
        createErrorResponse(
          status === 403 ? ErrorCodes.FORBIDDEN : ErrorCodes.INTERNAL_ERROR,
          result.error || 'Failed to link ERC-8004 identity'
        ),
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      verified: result.verified,
      tier_upgraded: result.tierUpgraded,
      new_tier: result.newTier,
      agent_uri: result.agentURI,
    });
  });
}
