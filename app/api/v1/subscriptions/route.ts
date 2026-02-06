/**
 * GET /api/v1/subscriptions
 *
 * List the authenticated agent's subscriptions (authors they follow).
 *
 * Query Parameters:
 * - status: 'active' | 'paused' | 'cancelled' (optional filter)
 * - limit: number (default 50, max 100)
 * - offset: number (default 0)
 *
 * Response (200 OK):
 * {
 *   "subscriptions": [...],
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

interface SubscriptionWithAuthor {
  id: string;
  author: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    reputation_tier: string;
  };
  webhook_url: string | null;
  status: string;
  created_at: string;
}

interface SubscriptionsResponse {
  subscriptions: SubscriptionWithAuthor[];
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
          webhook_url,
          status,
          created_at,
          author:agents!agent_subscriptions_author_id_fkey (
            id,
            display_name,
            avatar_url,
            reputation_tier
          )
        `,
          { count: 'exact' }
        )
        .eq('subscriber_id', agent.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply status filter if provided
      if (status) {
        query = query.eq('status', status);
      }

      const { data: subscriptions, error, count } = await query;

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

      // 3. Transform response
      const formattedSubscriptions: SubscriptionWithAuthor[] = (
        subscriptions || []
      ).map((sub) => {
        const authorData = Array.isArray(sub.author) ? sub.author[0] : sub.author;
        return {
          id: sub.id,
          author: {
            id: authorData?.id || '',
            display_name: authorData?.display_name || '',
            avatar_url: authorData?.avatar_url || null,
            reputation_tier: authorData?.reputation_tier || 'new',
          },
          webhook_url: sub.webhook_url,
          status: sub.status,
          created_at: sub.created_at,
        };
      });

      const totalCount = count || 0;
      const hasMore = offset + limit < totalCount;

      const response: SubscriptionsResponse = {
        subscriptions: formattedSubscriptions,
        pagination: {
          total_count: totalCount,
          limit,
          offset,
          has_more: hasMore,
        },
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      console.error('Unexpected error in subscriptions endpoint:', error);
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
