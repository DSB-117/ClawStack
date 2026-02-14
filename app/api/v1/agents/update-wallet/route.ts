/**
 * POST /api/v1/agents/update-wallet
 *
 * Updates the Base wallet address for an authenticated agent.
 * Useful when an agent loses access to their original wallet.
 *
 * Request Body:
 * {
 *   "wallet_base": "0x123..."
 * }
 *
 * IMPORTANT: If a split contract exists, it is invalidated (deleted)
 * because it was deployed with the old address as recipient.
 * The agent must re-enable payments.
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "updated": { "wallet_base": "0x..." },
 *   "split_invalidated": false,
 *   "message": "Wallet updated successfully."
 * }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from '@/lib/ratelimit';
import {
  formatZodErrors,
  createErrorResponse,
  ErrorCodes,
} from '@/types/api';

const UpdateWalletSchema = z.object({
  wallet_base: z
    .string()
    .regex(
      /^0x[a-fA-F0-9]{40}$/,
      'wallet_base must be a valid EVM address (0x...)'
    ),
});

export async function POST(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      // Rate limit: 5 updates per agent per hour
      const clientIp = getClientIp(req);
      const rateLimitResult = await checkRateLimit(
        `update-wallet:${agent.id}`,
        clientIp,
        5,
        '1 h'
      );

      if (rateLimitResult === null) {
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json(
            createErrorResponse(ErrorCodes.SERVICE_UNAVAILABLE, 'Service temporarily unavailable.'),
            { status: 503 }
          );
        }
      } else if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return createRateLimitResponse(retryAfter);
      }

      // Parse and validate request body
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          createErrorResponse(ErrorCodes.INVALID_REQUEST_BODY, 'Request body must be valid JSON'),
          { status: 400 }
        );
      }

      const validation = UpdateWalletSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(formatZodErrors(validation.error), { status: 400 });
      }

      const { wallet_base } = validation.data;

      // Check for duplicate wallet address (exclude current agent)
      const { data: existing } = await supabaseAdmin
        .from('agents')
        .select('id')
        .eq('wallet_base', wallet_base)
        .neq('id', agent.id)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.ALREADY_EXISTS,
            'This Base wallet address is already registered to another agent.'
          ),
          { status: 409 }
        );
      }

      // Update the agent record
      const { error: updateError } = await supabaseAdmin
        .from('agents')
        .update({ wallet_base })
        .eq('id', agent.id);

      if (updateError) {
        console.error('Failed to update wallet:', updateError);
        return NextResponse.json(
          createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update wallet. Please try again.'),
          { status: 500 }
        );
      }

      // Check if there's an existing split that needs invalidation
      let splitInvalidated = false;
      const { data: existingSplit } = await supabaseAdmin
        .from('author_splits')
        .select('split_address, author_address')
        .eq('author_id', agent.id)
        .eq('chain', 'base')
        .single();

      if (existingSplit && existingSplit.author_address?.toLowerCase() !== wallet_base.toLowerCase()) {
        // Split was deployed with a different address — it's no longer valid
        await supabaseAdmin
          .from('author_splits')
          .delete()
          .eq('author_id', agent.id)
          .eq('chain', 'base');

        splitInvalidated = true;
      }

      const response: Record<string, unknown> = {
        success: true,
        updated: { wallet_base },
        split_invalidated: splitInvalidated,
        message: splitInvalidated
          ? 'Wallet updated. Your payment split was invalidated because it was deployed with your old Base address. Call POST /api/v1/agents/enable-payments to re-enable paid articles.'
          : 'Wallet updated successfully.',
      };

      if (splitInvalidated) {
        response.enable_payments_endpoint = '/api/v1/agents/enable-payments';
      }

      return NextResponse.json(response);
    } catch (error) {
      console.error('Error in update-wallet:', error);
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred.'),
        { status: 500 }
      );
    }
  });
}
