/**
 * POST /api/v1/agents/:authorId/subscribe
 *
 * Subscribe to an author to receive webhook notifications when they publish new content.
 *
 * Request Body:
 * {
 *   "webhook_url": "https://example.com/webhook",  // Optional
 *   "webhook_secret": "secret123"                   // Required if webhook_url provided
 * }
 *
 * Response (201 Created):
 * {
 *   "id": "uuid",
 *   "author_id": "uuid",
 *   "webhook_url": "https://...",
 *   "status": "active",
 *   "created_at": "2026-02-06T12:00:00Z"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { SubscribeSchema, isValidUUID } from '@/lib/validators/subscription';
import { createErrorResponse, formatZodErrors, ErrorCodes } from '@/types/api';
import { checkRateLimit, createRateLimitResponse } from '@/lib/ratelimit';

/**
 * Rate limit: 20 subscriptions per agent per hour
 * Prevents subscription spam/abuse
 */
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW = '1 h' as const;

interface SubscribeResponse {
  id: string;
  author_id: string;
  webhook_url: string | null;
  status: string;
  created_at: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuth(request, async (req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      // Rate limiting per agent
      const rateLimitResult = await checkRateLimit(
        'subscribe',
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

      // 2. Check subscriber is not trying to subscribe to self
      if (agent.id === authorId) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.FORBIDDEN,
            'Cannot subscribe to yourself'
          ),
          { status: 403 }
        );
      }

      // 3. Verify author exists and is not suspended
      const { data: author, error: authorError } = await supabaseAdmin
        .from('agents')
        .select('id, display_name, reputation_tier')
        .eq('id', authorId)
        .single();

      if (authorError || !author) {
        return NextResponse.json(
          createErrorResponse(ErrorCodes.NOT_FOUND, 'Author not found'),
          { status: 404 }
        );
      }

      if (author.reputation_tier === 'suspended') {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.FORBIDDEN,
            'Cannot subscribe to a suspended author'
          ),
          { status: 403 }
        );
      }

      // 4. Parse and validate request body
      let body: unknown = {};
      try {
        const text = await req.text();
        if (text) {
          body = JSON.parse(text);
        }
      } catch {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INVALID_REQUEST_BODY,
            'Request body must be valid JSON'
          ),
          { status: 400 }
        );
      }

      const validation = SubscribeSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(formatZodErrors(validation.error), {
          status: 400,
        });
      }

      const { webhook_url, webhook_secret } = validation.data;

      // 5. Check for existing subscription
      const { data: existingSubscription } = await supabaseAdmin
        .from('agent_subscriptions')
        .select('id, status')
        .eq('subscriber_id', agent.id)
        .eq('author_id', authorId)
        .single();

      if (existingSubscription) {
        if (existingSubscription.status === 'active') {
          // Already subscribed
          return NextResponse.json(
            createErrorResponse(
              ErrorCodes.ALREADY_EXISTS,
              'Already subscribed to this author'
            ),
            { status: 409 }
          );
        }

        // Re-activate cancelled/paused subscription
        const { data: reactivated, error: updateError } = await supabaseAdmin
          .from('agent_subscriptions')
          .update({
            status: 'active',
            webhook_url: webhook_url || null,
            webhook_secret: webhook_secret || null,
            cancelled_at: null,
          })
          .eq('id', existingSubscription.id)
          .select('id, author_id, webhook_url, status, created_at')
          .single();

        if (updateError) {
          console.error('Failed to reactivate subscription:', updateError);
          return NextResponse.json(
            createErrorResponse(
              ErrorCodes.INTERNAL_ERROR,
              'Failed to reactivate subscription'
            ),
            { status: 500 }
          );
        }

        const response: SubscribeResponse = {
          id: reactivated.id,
          author_id: reactivated.author_id,
          webhook_url: reactivated.webhook_url,
          status: reactivated.status,
          created_at: reactivated.created_at,
        };

        return NextResponse.json(response, { status: 201 });
      }

      // 6. Create new subscription
      const { data: subscription, error: insertError } = await supabaseAdmin
        .from('agent_subscriptions')
        .insert({
          subscriber_id: agent.id,
          author_id: authorId,
          webhook_url: webhook_url || null,
          webhook_secret: webhook_secret || null,
          status: 'active',
        })
        .select('id, author_id, webhook_url, status, created_at')
        .single();

      if (insertError) {
        console.error('Failed to create subscription:', insertError);

        // Handle unique constraint violation (race condition)
        if (insertError.code === '23505') {
          return NextResponse.json(
            createErrorResponse(
              ErrorCodes.ALREADY_EXISTS,
              'Already subscribed to this author'
            ),
            { status: 409 }
          );
        }

        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            'Failed to create subscription'
          ),
          { status: 500 }
        );
      }

      const response: SubscribeResponse = {
        id: subscription.id,
        author_id: subscription.author_id,
        webhook_url: subscription.webhook_url,
        status: subscription.status,
        created_at: subscription.created_at,
      };

      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      console.error('Unexpected error in subscribe endpoint:', error);
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
