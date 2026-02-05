/**
 * GET /api/v1/agents/erc8004-status
 *
 * Returns the ERC-8004 identity link status for the authenticated agent.
 *
 * Response (200 OK) - Linked:
 * {
 *   "linked": true,
 *   "token_id": 123,
 *   "registry_address": "0x...",
 *   "chain_id": 8453,
 *   "verified_at": "2026-02-05T18:00:00Z",
 *   "agent_uri": "https://...",
 *   "explorer_url": "https://basescan.org/token/...",
 *   "reputation": {
 *     "count": 10,
 *     "normalized_score": 85
 *   }
 * }
 *
 * Response (200 OK) - Not Linked:
 * {
 *   "linked": false,
 *   "message": "No ERC-8004 identity linked to this agent"
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
  getERC8004ReputationSummary,
  getERC8004ExplorerUrl,
} from '@/lib/evm/erc8004';
import { createErrorResponse, ErrorCodes } from '@/types/api';

export async function GET(request: NextRequest): Promise<Response> {
  return withAuth(request, async (_req, agent) => {
    try {
      // Get link status from database
      const linkStatus = await getERC8004LinkStatus(agent.id);

      if (!linkStatus) {
        return NextResponse.json({
          linked: false,
          message: 'No ERC-8004 identity linked to this agent',
        });
      }

      // Get explorer URL
      const explorerUrl = getERC8004ExplorerUrl(
        linkStatus.erc8004_chain_id,
        linkStatus.erc8004_registry_address,
        BigInt(linkStatus.erc8004_token_id)
      );

      // Try to get current reputation (optional - may fail if registry unavailable)
      let reputation: { count: number; normalized_score: number } | null = null;
      try {
        const repSummary = await getERC8004ReputationSummary(
          BigInt(linkStatus.erc8004_token_id),
          linkStatus.erc8004_chain_id
        );
        if (repSummary) {
          reputation = {
            count: repSummary.count,
            normalized_score: Math.round(repSummary.normalizedScore),
          };
        }
      } catch {
        // Reputation fetch failed - continue without it
      }

      return NextResponse.json({
        linked: true,
        token_id: linkStatus.erc8004_token_id,
        registry_address: linkStatus.erc8004_registry_address,
        chain_id: linkStatus.erc8004_chain_id,
        verified_at: linkStatus.erc8004_verified_at,
        agent_uri: linkStatus.erc8004_agent_uri,
        explorer_url: explorerUrl,
        reputation,
      });
    } catch (error) {
      console.error('Error fetching ERC-8004 status:', error);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to fetch ERC-8004 status'
        ),
        { status: 500 }
      );
    }
  });
}
