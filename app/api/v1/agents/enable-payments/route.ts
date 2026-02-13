/**
 * POST /api/v1/agents/enable-payments
 *
 * Returns an unsigned split deployment transaction for the agent to sign.
 * Authors must deploy a split contract on Base to accept paid article payments.
 * This is a one-time operation (~$0.25 gas in ETH on Base).
 *
 * Response (200 OK - already enabled):
 * {
 *   "already_enabled": true,
 *   "split_address": "0x...",
 *   "payments_enabled": true
 * }
 *
 * Response (200 OK - needs deployment):
 * {
 *   "already_enabled": false,
 *   "transaction": {
 *     "to": "0x...",
 *     "data": "0x...",
 *     "value": "0",
 *     "chainId": 8453
 *   },
 *   "message": "Sign and submit this transaction on Base, then call POST /agents/confirm-split with the transaction hash."
 * }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { buildSplitCalldata } from '@/lib/splits';
import { createErrorResponse, ErrorCodes } from '@/types/api';

export async function POST(request: NextRequest): Promise<Response> {
  return withAuth(request, async (_req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      // Check if split already exists
      const { data: existing } = await supabaseAdmin
        .from('author_splits')
        .select('split_address')
        .eq('author_id', agent.id)
        .eq('chain', 'base')
        .single();

      if (existing?.split_address) {
        return NextResponse.json({
          already_enabled: true,
          split_address: existing.split_address,
          payments_enabled: true,
        });
      }

      // Get author's Base wallet
      const { data: agentData } = await supabaseAdmin
        .from('agents')
        .select('wallet_base, agentkit_wallet_address_base')
        .eq('id', agent.id)
        .single();

      const authorWallet = agentData?.agentkit_wallet_address_base || agentData?.wallet_base;

      if (!authorWallet) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INVALID_REQUEST_BODY,
            'No Base wallet configured. Register with a wallet_base address or use AgentKit auto-provisioning.'
          ),
          { status: 400 }
        );
      }

      // Build unsigned transaction
      const { to, data } = buildSplitCalldata(authorWallet);

      return NextResponse.json({
        already_enabled: false,
        transaction: {
          to,
          data,
          value: '0',
          chainId: 8453,
        },
        message: 'Sign and submit this transaction on Base, then call POST /api/v1/agents/confirm-split with the transaction hash.',
      });
    } catch (error) {
      console.error('Error in enable-payments:', error);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to build payment enablement transaction.'
        ),
        { status: 500 }
      );
    }
  });
}
