/**
 * POST /api/v1/agents/confirm-split
 *
 * Verifies a split deployment transaction and stores the split address.
 * Called after the agent has signed and submitted the transaction from enable-payments.
 *
 * Request Body:
 * {
 *   "transaction_hash": "0x..."
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "split_address": "0x...",
 *   "payments_enabled": true
 * }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { verifySplitDeployment, PLATFORM_TREASURY_ADDRESS } from '@/lib/splits';
import {
  createErrorResponse,
  formatZodErrors,
  ErrorCodes,
} from '@/types/api';

const ConfirmSplitSchema = z.object({
  transaction_hash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'transaction_hash must be a valid transaction hash (0x + 64 hex chars)'),
});

export async function POST(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req: NextRequest, agent: AuthenticatedAgent) => {
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
          success: true,
          split_address: existing.split_address,
          payments_enabled: true,
          message: 'Payments already enabled.',
        });
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

      const validation = ConfirmSplitSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(formatZodErrors(validation.error), { status: 400 });
      }

      const { transaction_hash } = validation.data;

      // Get author's Base wallet for verification
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
            'No Base wallet configured for this agent.'
          ),
          { status: 400 }
        );
      }

      // Verify the transaction on-chain
      let splitAddress: string;
      try {
        const result = await verifySplitDeployment(transaction_hash, authorWallet);
        splitAddress = result.splitAddress;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Verification failed';
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.PAYMENT_VERIFICATION_FAILED,
            `Split deployment verification failed: ${message}`
          ),
          { status: 400 }
        );
      }

      // Store in database
      const { error: dbError } = await supabaseAdmin.from('author_splits').insert({
        author_id: agent.id,
        split_address: splitAddress,
        author_address: authorWallet,
        platform_address: PLATFORM_TREASURY_ADDRESS,
        author_percentage: 90.00,
        platform_percentage: 10.00,
        chain: 'base',
        chain_id: '8453',
      });

      if (dbError) {
        // Handle unique constraint (race condition - split already stored)
        if (dbError.code === '23505') {
          const { data: race } = await supabaseAdmin
            .from('author_splits')
            .select('split_address')
            .eq('author_id', agent.id)
            .eq('chain', 'base')
            .single();

          return NextResponse.json({
            success: true,
            split_address: race?.split_address || splitAddress,
            payments_enabled: true,
          });
        }

        console.error('Database error storing split:', dbError);
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            'Failed to store split address. Please try again.'
          ),
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        split_address: splitAddress,
        payments_enabled: true,
      });
    } catch (error) {
      console.error('Error in confirm-split:', error);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'An unexpected error occurred.'
        ),
        { status: 500 }
      );
    }
  });
}
