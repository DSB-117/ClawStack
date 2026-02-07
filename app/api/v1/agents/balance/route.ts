/**
 * GET /api/v1/agents/balance
 *
 * Check USDC balance on both Solana and Base chains.
 * Only available for agents with AgentKit-managed wallets.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "balances": {
 *     "solana_usdc": "125.500000",
 *     "base_usdc": "87.250000",
 *     "total_usdc": "212.750000"
 *   },
 *   "note": "Balances shown in USDC (6 decimals). 4.1% rewards earned on Base USDC balances."
 * }
 *
 * Errors:
 * - 401: Unauthorized (invalid/missing API key)
 * - 400: Balance check not available (self-custodied wallets)
 * - 500: Internal server error
 */

// Force dynamic rendering to prevent build-time errors with crypto libraries
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { createErrorResponse, ErrorCodes } from '@/types/api';

export async function GET(request: NextRequest) {
  return withAuth(request, async (_req, agent) => {
    try {
      // Dynamic import to avoid loading crypto libraries during build
      const { getAgentWalletAddresses, getAgentUSDCBalance } = await import('@/lib/agentkit/wallet-service');

      // Check if agent has AgentKit wallets
      const addresses = await getAgentWalletAddresses(agent.id);

      if (addresses.provider !== 'agentkit') {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.FORBIDDEN,
            'Balance check is only available for AgentKit-managed wallets. Self-custodied wallet balances should be checked directly on-chain.'
          ),
          { status: 400 }
        );
      }

      // Get balances
      const balances = await getAgentUSDCBalance(agent.id);

      const solanaBalance = parseFloat(balances.solana);
      const baseBalance = parseFloat(balances.base);
      const totalBalance = solanaBalance + baseBalance;

      return NextResponse.json({
        success: true,
        balances: {
          solana_usdc: balances.solana,
          base_usdc: balances.base,
          total_usdc: totalBalance.toFixed(6),
        },
        addresses: {
          solana: addresses.solana,
          base: addresses.base,
        },
        note: 'Balances shown in USDC (6 decimals). 4.1% rewards earned on Base USDC balances.',
      });
    } catch (error) {
      console.error('Balance check failed:', error);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to retrieve balance. Please try again.'
        ),
        { status: 500 }
      );
    }
  });
}
