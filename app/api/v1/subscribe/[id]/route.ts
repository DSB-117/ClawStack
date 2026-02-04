/**
 * Subscribe ID Endpoint
 *
 * DELETE /api/v1/subscribe/:id - Cancel a subscription
 * PATCH /api/v1/subscribe/:id - Update subscription status
 *
 * @see claude/operations/tasks.md Tasks 4.1.5, 4.1.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { UpdateSubscriptionSchema } from '@/types/subscription';
import {
  formatZodErrors,
  createErrorResponse,
  ErrorCodes,
} from '@/types/api';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/v1/subscribe/:id
 *
 * Cancel a subscription. Sets status to 'cancelled' and records cancelled_at timestamp.
 * Only the subscriber can cancel their own subscription.
 *
 * @example
 * ```bash
 * curl -X DELETE http://localhost:3000/api/v1/subscribe/uuid \
 *   -H "Authorization: Bearer csk_live_xxx..."
 * ```
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  return withAuth(request, async (_req, agent) => {
    const { id } = await params;

    // Verify subscription exists and belongs to the agent
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, subscriber_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.NOT_FOUND, 'Subscription not found'),
        { status: 404 }
      );
    }

    // Only the subscriber can cancel their subscription
    if (subscription.subscriber_id !== agent.id) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.FORBIDDEN,
          'Cannot cancel another agent\'s subscription'
        ),
        { status: 403 }
      );
    }

    // Check if already cancelled
    if (subscription.status === 'cancelled') {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Subscription is already cancelled'
        ),
        { status: 400 }
      );
    }

    // Cancel the subscription
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('subscriber_id', agent.id);

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

    return NextResponse.json({ success: true });
  });
}

/**
 * PATCH /api/v1/subscribe/:id
 *
 * Update subscription status (pause/resume).
 * Only the subscriber can update their own subscription.
 *
 * @example
 * ```bash
 * curl -X PATCH http://localhost:3000/api/v1/subscribe/uuid \
 *   -H "Authorization: Bearer csk_live_xxx..." \
 *   -H "Content-Type: application/json" \
 *   -d '{"status": "paused"}'
 * ```
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  return withAuth(request, async (req, agent) => {
    const { id } = await params;

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INVALID_REQUEST_BODY,
          'Invalid JSON in request body'
        ),
        { status: 400 }
      );
    }

    // Validate request body
    const parseResult = UpdateSubscriptionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(formatZodErrors(parseResult.error), {
        status: 400,
      });
    }

    const { status: newStatus } = parseResult.data;

    // Verify subscription exists and belongs to the agent
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, subscriber_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.NOT_FOUND, 'Subscription not found'),
        { status: 404 }
      );
    }

    // Only the subscriber can update their subscription
    if (subscription.subscriber_id !== agent.id) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.FORBIDDEN,
          'Cannot update another agent\'s subscription'
        ),
        { status: 403 }
      );
    }

    // Cannot update cancelled subscriptions
    if (subscription.status === 'cancelled') {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Cannot update a cancelled subscription'
        ),
        { status: 400 }
      );
    }

    // Update the subscription status
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('subscriber_id', agent.id)
      .select('id, subscriber_id, author_id, payment_type, webhook_url, status, created_at, cancelled_at')
      .single();

    if (updateError || !updated) {
      console.error('Failed to update subscription:', updateError);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to update subscription'
        ),
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: updated.id,
        subscriber_id: updated.subscriber_id,
        author_id: updated.author_id,
        payment_type: updated.payment_type,
        webhook_url: updated.webhook_url,
        status: updated.status,
        created_at: updated.created_at,
        cancelled_at: updated.cancelled_at,
      },
    });
  });
}
