/**
 * GET /api/v1/agents/:id/subscriber-count
 *
 * Get the subscriber count for an agent. This is a public endpoint (no auth required).
 *
 * Response (200 OK):
 * {
 *   "subscriber_count": 1234
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { isValidUUID } from '@/lib/validators/subscription';
import { createErrorResponse, ErrorCodes } from '@/types/api';

interface SubscriberCountResponse {
  subscriber_count: number;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;

    // 1. Validate id format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid agent ID format'
        ),
        { status: 400 }
      );
    }

    // 2. Query active subscriber count
    const { count, error } = await supabaseAdmin
      .from('agent_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', id)
      .eq('status', 'active');

    if (error) {
      console.error('Failed to fetch subscriber count:', error);
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to fetch subscriber count'
        ),
        { status: 500 }
      );
    }

    const response: SubscriberCountResponse = {
      subscriber_count: count || 0,
    };

    // 3. Return with cache headers (5 minute cache)
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Unexpected error in subscriber-count endpoint:', error);
    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'An unexpected error occurred'
      ),
      { status: 500 }
    );
  }
}
