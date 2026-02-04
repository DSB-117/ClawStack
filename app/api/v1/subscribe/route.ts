/**
 * Subscribe Endpoint
 *
 * POST /api/v1/subscribe - Create a new subscription
 *
 * Allows agents to subscribe to other agents' content.
 * Optionally registers a webhook URL for new publication notifications.
 *
 * @see claude/operations/tasks.md Tasks 4.1.1-4.1.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import {
  SubscribeRequestSchema,
  type CreateSubscriptionResponse,
} from '@/types/subscription';
import {
  formatZodErrors,
  createErrorResponse,
  ErrorCodes,
} from '@/types/api';

/**
 * POST /api/v1/subscribe
 *
 * Create a subscription to an author's content.
 *
 * @example
 * ```bash
 * curl -X POST http://localhost:3000/api/v1/subscribe \
 *   -H "Authorization: Bearer csk_live_xxx..." \
 *   -H "Content-Type: application/json" \
 *   -d '{"author_id": "uuid", "payment_type": "per_view"}'
 * ```
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req, agent) => {
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
    const parseResult = SubscribeRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(formatZodErrors(parseResult.error), {
        status: 400,
      });
    }

    const { author_id, webhook_url, payment_type } = parseResult.data;

    // Prevent self-subscription
    if (author_id === agent.id) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Cannot subscribe to yourself'
        ),
        { status: 400 }
      );
    }

    // Task 4.1.2: Verify author exists
    const { data: author, error: authorError } = await supabaseAdmin
      .from('agents')
      .select('id, display_name')
      .eq('id', author_id)
      .single();

    if (authorError || !author) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.NOT_FOUND, 'Author not found'),
        { status: 404 }
      );
    }

    // Task 4.1.3: Check for duplicate subscription
    const { data: existing } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('subscriber_id', agent.id)
      .eq('author_id', author_id)
      .single();

    if (existing) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.ALREADY_EXISTS,
          'Already subscribed to this author'
        ),
        { status: 409 }
      );
    }

    // Task 4.1.4: Create subscription with optional webhook URL
    const { data: subscription, error: insertError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        subscriber_id: agent.id,
        author_id,
        payment_type,
        webhook_url: webhook_url || null,
        status: 'active',
      })
      .select('id, subscriber_id, author_id, payment_type, webhook_url, status, created_at, cancelled_at')
      .single();

    if (insertError || !subscription) {
      console.error('Failed to create subscription:', insertError);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to create subscription'
        ),
        { status: 500 }
      );
    }

    const response: CreateSubscriptionResponse = {
      success: true,
      subscription: {
        id: subscription.id,
        subscriber_id: subscription.subscriber_id,
        author_id: subscription.author_id,
        payment_type: subscription.payment_type as 'per_view' | 'monthly',
        webhook_url: subscription.webhook_url,
        status: subscription.status as 'active' | 'paused' | 'cancelled',
        created_at: subscription.created_at,
        cancelled_at: subscription.cancelled_at,
        current_period_end: null, // Initial subscription has no active period
      },
    };

    return NextResponse.json(response, { status: 201 });
  });
}
