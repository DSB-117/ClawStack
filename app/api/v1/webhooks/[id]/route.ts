/**
 * GET/PATCH/DELETE /api/v1/webhooks/:id
 *
 * Individual webhook configuration management.
 *
 * GET: Get a specific webhook config
 * PATCH: Update a webhook config
 * DELETE: Delete a webhook config
 *
 * @see claude/operations/tasks.md Task 4.2.8
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { UpdateWebhookSchema } from '@/lib/validators/webhook';
import { formatZodErrors, createErrorResponse, ErrorCodes } from '@/types/api';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/webhooks/:id
 *
 * Get a specific webhook configuration
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const { id: webhookId } = await params;

  return withAuth(request, async (_req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      const { data: webhook, error } = await supabaseAdmin
        .from('webhook_configs')
        .select('id, url, events_filter, active, last_triggered_at, consecutive_failures, created_at')
        .eq('id', webhookId)
        .eq('agent_id', agent.id) // Ensure ownership
        .single();

      if (error || !webhook) {
        return NextResponse.json(
          createErrorResponse(ErrorCodes.NOT_FOUND, 'Webhook configuration not found'),
          { status: 404 }
        );
      }

      return NextResponse.json({ webhook });
    } catch (error) {
      console.error('Unexpected error in GET /webhooks/:id:', error);
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred'),
        { status: 500 }
      );
    }
  });
}

/**
 * PATCH /api/v1/webhooks/:id
 *
 * Update a webhook configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const { id: webhookId } = await params;

  return withAuth(request, async (req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      // Verify ownership first
      const { data: existing } = await supabaseAdmin
        .from('webhook_configs')
        .select('id')
        .eq('id', webhookId)
        .eq('agent_id', agent.id)
        .single();

      if (!existing) {
        return NextResponse.json(
          createErrorResponse(ErrorCodes.NOT_FOUND, 'Webhook configuration not found'),
          { status: 404 }
        );
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

      const validation = UpdateWebhookSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(formatZodErrors(validation.error), { status: 400 });
      }

      const updateData = validation.data;

      // If re-activating, reset failure count
      if (updateData.active === true) {
        (updateData as Record<string, unknown>).consecutive_failures = 0;
      }

      // Update webhook config
      const { data: webhook, error } = await supabaseAdmin
        .from('webhook_configs')
        .update(updateData)
        .eq('id', webhookId)
        .eq('agent_id', agent.id)
        .select('id, url, events_filter, active, last_triggered_at, consecutive_failures, created_at')
        .single();

      if (error) {
        console.error('Database error updating webhook:', error);
        return NextResponse.json(
          createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update webhook configuration'),
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        webhook,
      });
    } catch (error) {
      console.error('Unexpected error in PATCH /webhooks/:id:', error);
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred'),
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/v1/webhooks/:id
 *
 * Delete a webhook configuration
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const { id: webhookId } = await params;

  return withAuth(request, async (_req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      // Delete webhook config (ensuring ownership)
      const { error, count } = await supabaseAdmin
        .from('webhook_configs')
        .delete()
        .eq('id', webhookId)
        .eq('agent_id', agent.id);

      if (error) {
        console.error('Database error deleting webhook:', error);
        return NextResponse.json(
          createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to delete webhook configuration'),
          { status: 500 }
        );
      }

      if (count === 0) {
        return NextResponse.json(
          createErrorResponse(ErrorCodes.NOT_FOUND, 'Webhook configuration not found'),
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Webhook configuration deleted',
      });
    } catch (error) {
      console.error('Unexpected error in DELETE /webhooks/:id:', error);
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred'),
        { status: 500 }
      );
    }
  });
}
