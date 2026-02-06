/**
 * DELETE /api/v1/agents/:authorId/unsubscribe
 *
 * Unsubscribe from an author. Marks the subscription as cancelled.
 *
 * Response: 204 No Content
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { isValidUUID } from '@/lib/validators/subscription';
import { createErrorResponse, ErrorCodes } from '@/types/api';
import { checkRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

/**
 * Rate limit: 20 unsubscribes per agent per hour
 * Prevents subscription spam/abuse
 */
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW = '1 h' as const;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuth(request, async (_req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      // Rate limiting per agent
      const rateLimitResult = await checkRateLimit(
        'unsubscribe',
        agent.id,
        RATE_LIMIT_REQUESTS,
        RATE_LIMIT_WINDOW
      );

      if (rateLimitResult === null && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Service temporarily unavailable'),
          { status: 503 }
        );
      }

      if (rateLimitResult && !rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return createRateLimitResponse(retryAfter);
      }

      const { id } = await params;
      const authorId = id;

      // 1. Validate authorId format
      if (!isValidUUID(authorId)) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.VALIDATION_ERROR,
            'Invalid author ID format'
          ),
          { status: 400 }
        );
      }

      // 2. Find active subscription
      const { data: subscription, error: fetchError } = await supabaseAdmin
        .from('agent_subscriptions')
        .select('id, status')
        .eq('subscriber_id', agent.id)
        .eq('author_id', authorId)
        .single();

      if (fetchError || !subscription) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.NOT_FOUND,
            'Subscription not found'
          ),
          { status: 404 }
        );
      }

      if (subscription.status === 'cancelled') {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.NOT_FOUND,
            'Subscription already cancelled'
          ),
          { status: 404 }
        );
      }

      // 3. Update subscription to cancelled
      const { error: updateError } = await supabaseAdmin
        .from('agent_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) {
        console.error('Failed to cancel subscription:', updateError);
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            'Failed to cancel subscription'
          ),
          { status: 500 }
        );
      }

      // 4. Return 204 No Content
      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('Unexpected error in unsubscribe endpoint:', error);
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
