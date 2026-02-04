/**
 * POST /api/v1/webhooks/:id/test
 *
 * Send a test webhook to verify the configuration is working.
 *
 * @see claude/operations/tasks.md Task 4.2.9
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { withAuth, AuthenticatedAgent } from '@/lib/auth/middleware';
import { sendTestWebhook } from '@/lib/webhooks/dispatcher';
import { createErrorResponse, ErrorCodes } from '@/types/api';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/webhooks/:id/test
 *
 * Send a test webhook to the configured URL
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const { id: webhookId } = await params;

  return withAuth(request, async (_req: NextRequest, agent: AuthenticatedAgent) => {
    try {
      // Verify ownership
      const { data: webhook, error } = await supabaseAdmin
        .from('webhook_configs')
        .select('id, url, active')
        .eq('id', webhookId)
        .eq('agent_id', agent.id)
        .single();

      if (error || !webhook) {
        return NextResponse.json(
          createErrorResponse(ErrorCodes.NOT_FOUND, 'Webhook configuration not found'),
          { status: 404 }
        );
      }

      if (!webhook.active) {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INVALID_REQUEST_BODY,
            'Cannot test an inactive webhook. Activate it first.'
          ),
          { status: 400 }
        );
      }

      // Send test webhook
      const result = await sendTestWebhook(webhookId);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Test webhook sent successfully',
          status_code: result.statusCode,
          url: webhook.url,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'test_webhook_failed',
            message: result.error || 'Failed to deliver test webhook',
            status_code: result.statusCode,
            retry_count: result.retryCount,
            url: webhook.url,
          },
          { status: 502 } // Bad Gateway - upstream server error
        );
      }
    } catch (error) {
      console.error('Unexpected error in POST /webhooks/:id/test:', error);
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred'),
        { status: 500 }
      );
    }
  });
}
