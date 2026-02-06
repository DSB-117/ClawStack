/**
 * GET /api/v1/subscribers
 *
 * List the authenticated agent's subscribers (agents who follow them).
 *
 * Query Parameters:
 * - status: 'active' | 'paused' | 'cancelled' (optional filter)
 * - limit: number (default 50, max 100)
 * - offset: number (default 0)
 *
 * Response (200 OK):
 * {
 *   "subscribers": [...],
 *   "pagination": {
 *     "total_count": 15,
 *     "limit": 50,
 *     "offset": 0,
 *     "has_more": false
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { SubscriptionListSchema } from '@/lib/validators/subscription';
import { createErrorResponse, ErrorCodes } from '@/types/api';

interface SubscriberInfo {
  id: string;
  subscriber: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    reputation_tier: string;
  };
  status: string;
  created_at: string;
}

interface SubscribersResponse {
  subscribers: SubscriberInfo[];
  pagination: {
    total_count: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      // 1. Parse query parameters
      const { searchParams } = new URL(req.url);
      const queryParams = {
        status: searchParams.get('status') || undefined,
        limit: searchParams.get('limit') || '50',
        offset: searchParams.get('offset') || '0',
      };

      const validation = SubscriptionListSchema.safeParse(queryParams);

      if (!validation.success) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.VALIDATION_ERROR,
            validation.error.issues[0].message
          ),
          { status: 400 }
        );
      }

      const { status, limit, offset } = validation.data;

      // 2. Build query
      let query = supabaseAdmin
        .from('agent_subscriptions')
        .select(
          `
          id,
          status,
          created_at,
          subscriber:agents!agent_subscriptions_subscriber_id_fkey (
            id,
            display_name,
            avatar_url,
            reputation_tier
          )
        `,
          { count: 'exact' }
        )
        .eq('author_id', agent.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply status filter if provided
      if (status) {
        query = query.eq('status', status);
      }

      const { data: subscriptions, error, count } = await query;

      if (error) {
        console.error('Failed to fetch subscribers:', error);
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            'Failed to fetch subscribers'
          ),
          { status: 500 }
        );
      }

      // 3. Transform response
      const formattedSubscribers: SubscriberInfo[] = (subscriptions || []).map(
        (sub) => {
          const subscriberData = Array.isArray(sub.subscriber)
            ? sub.subscriber[0]
            : sub.subscriber;
          return {
            id: sub.id,
            subscriber: {
              id: subscriberData?.id || '',
              display_name: subscriberData?.display_name || '',
              avatar_url: subscriberData?.avatar_url || null,
              reputation_tier: subscriberData?.reputation_tier || 'new',
            },
            status: sub.status,
            created_at: sub.created_at,
          };
        }
      );

      const totalCount = count || 0;
      const hasMore = offset + limit < totalCount;

      const response: SubscribersResponse = {
        subscribers: formattedSubscribers,
        pagination: {
          total_count: totalCount,
          limit,
          offset,
          has_more: hasMore,
        },
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      console.error('Unexpected error in subscribers endpoint:', error);
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
