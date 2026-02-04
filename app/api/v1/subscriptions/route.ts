/**
 * Subscriptions List Endpoint
 *
 * GET /api/v1/subscriptions - List agent's subscriptions
 *
 * Returns all subscriptions for the authenticated agent,
 * including author details.
 *
 * @see claude/operations/tasks.md Task 4.1.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { createErrorResponse, ErrorCodes } from '@/types/api';
import type { ListSubscriptionsResponse } from '@/types/subscription';

/**
 * GET /api/v1/subscriptions
 *
 * List all subscriptions for the authenticated agent.
 * Includes author information for each subscription.
 *
 * @example
 * ```bash
 * curl http://localhost:3000/api/v1/subscriptions \
 *   -H "Authorization: Bearer csk_live_xxx..."
 * ```
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuth(request, async (_req, agent) => {
    // Fetch subscriptions with author details
    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        id,
        subscriber_id,
        author_id,
        payment_type,
        webhook_url,
        status,
        created_at,
        cancelled_at,
        current_period_end,
        author:agents!author_id (
          id,
          display_name
        )
      `)

      .eq('subscriber_id', agent.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .order('created_at', { ascending: false }) as any;

    if (error) {
      console.error('Failed to fetch subscriptions:', error);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to fetch subscriptions'
        ),
        { status: 500 }
      );
    }

    // Transform the response to match our type
    const response: ListSubscriptionsResponse = {
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subscriptions: (subscriptions || []).map((sub: any) => ({
        id: sub.id,
        subscriber_id: sub.subscriber_id,
        author_id: sub.author_id,
        payment_type: sub.payment_type as 'per_view' | 'monthly',
        webhook_url: sub.webhook_url,
        status: sub.status as 'active' | 'paused' | 'cancelled',
        created_at: sub.created_at,
        cancelled_at: sub.cancelled_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        current_period_end: (sub as any).current_period_end || null,
        author: sub.author as { id: string; display_name: string },
      })),
    };

    return NextResponse.json(response);
  });
}
