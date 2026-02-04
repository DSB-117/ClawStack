/**
 * GET/POST /api/v1/webhooks
 *
 * Webhook configuration management endpoints.
 *
 * GET: List all webhook configs for the authenticated agent
 * POST: Create a new webhook config
 *
 * @see claude/operations/tasks.md Task 4.2.8
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { CreateWebhookSchema } from '@/lib/validators/webhook';
import { generateWebhookSecret } from '@/lib/webhooks/sign';
import { formatZodErrors, createErrorResponse, ErrorCodes } from '@/types/api';

/**
 * GET /api/v1/webhooks
 *
 * List all webhook configurations for the authenticated agent
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuth(request, async (_req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      const { data: webhooks, error } = await supabaseAdmin
        .from('webhook_configs')
        .select('id, url, events_filter, active, last_triggered_at, consecutive_failures, created_at')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error fetching webhooks:', error);
        return NextResponse.json(
          createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch webhooks'),
          { status: 500 }
        );
      }

      return NextResponse.json({
        webhooks: webhooks || [],
        count: webhooks?.length || 0,
      });
    } catch (error) {
      console.error('Unexpected error in GET /webhooks:', error);
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred'),
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/v1/webhooks
 *
 * Create a new webhook configuration
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req: NextRequest, agent: AuthenticatedAgent) => {
    try {
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

      const validation = CreateWebhookSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(formatZodErrors(validation.error), { status: 400 });
      }

      const { url, events_filter } = validation.data;

      // Check if agent already has a webhook config (one per agent for simplicity)
      const { data: existing } = await supabaseAdmin
        .from('webhook_configs')
        .select('id')
        .eq('agent_id', agent.id)
        .single();

      if (existing) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.ALREADY_EXISTS,
            'Webhook configuration already exists. Use PATCH to update or DELETE to remove.'
          ),
          { status: 409 }
        );
      }

      // Generate webhook secret
      const secret = generateWebhookSecret();

      // Create webhook config
      const { data: webhook, error } = await supabaseAdmin
        .from('webhook_configs')
        .insert({
          agent_id: agent.id,
          url,
          secret,
          events_filter,
          active: true,
          consecutive_failures: 0,
        })
        .select('id, url, events_filter, active, created_at')
        .single();

      if (error) {
        console.error('Database error creating webhook:', error);
        return NextResponse.json(
          createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create webhook configuration'),
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          webhook: {
            ...webhook,
            // Include secret in creation response (only time it's returned)
            secret,
          },
          message: 'Webhook created. Store the secret securely - it will not be shown again.',
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Unexpected error in POST /webhooks:', error);
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred'),
        { status: 500 }
      );
    }
  });
}
