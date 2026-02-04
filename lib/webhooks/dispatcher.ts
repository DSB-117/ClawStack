/**
 * ClawStack Webhook Dispatcher
 *
 * Handles queuing, dispatching, retry logic, and failure tracking for webhooks.
 * Designed for serverless environment - can be upgraded to pg-boss for dedicated servers.
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import { signWebhookPayload, generateEventId } from './sign';
import type {
  WebhookJobData,
  AnyWebhookPayload,
  WebhookConfig,
  // WebhookEventType,
} from './types';

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s
const WEBHOOK_TIMEOUT_MS = 10000; // 10 second timeout
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Result of a webhook dispatch attempt
 */
export interface DispatchResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  retryCount: number;
}

/**
 * Dispatch a webhook to a URL with signing and retry logic
 */
async function dispatchWebhook(
  url: string,
  payload: AnyWebhookPayload,
  secret: string,
  retryCount = 0
): Promise<DispatchResult> {
  const payloadString = JSON.stringify(payload);
  const signature = signWebhookPayload(payloadString, secret);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ClawStack-Signature': signature,
        'X-ClawStack-Event-Id': payload.event_id,
        'X-ClawStack-Event-Type': payload.event_type,
        'User-Agent': 'ClawStack-Webhook/1.0',
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        retryCount,
      };
    }

    // Server error - may retry
    if (response.status >= 500 && retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1]);
      return dispatchWebhook(url, payload, secret, retryCount + 1);
    }

    // Client error or max retries reached
    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${response.statusText}`,
      retryCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Retry on network errors
    if (retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1]);
      return dispatchWebhook(url, payload, secret, retryCount + 1);
    }

    return {
      success: false,
      error: errorMessage,
      retryCount,
    };
  }
}

/**
 * Simple delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Update webhook config after delivery attempt
 */
async function updateWebhookStatus(
  webhookConfigId: string,
  success: boolean
): Promise<void> {
  try {
    if (success) {
      // Reset consecutive failures on success
      await supabaseAdmin
        .from('webhook_configs')
        .update({
          last_triggered_at: new Date().toISOString(),
          consecutive_failures: 0,
        })
        .eq('id', webhookConfigId);
    } else {
      // Increment failures and potentially disable
      const { data: config } = await supabaseAdmin
        .from('webhook_configs')
        .select('consecutive_failures')
        .eq('id', webhookConfigId)
        .single();

      const newFailureCount = (config?.consecutive_failures ?? 0) + 1;
      const shouldDisable = newFailureCount >= MAX_CONSECUTIVE_FAILURES;

      await supabaseAdmin
        .from('webhook_configs')
        .update({
          consecutive_failures: newFailureCount,
          active: !shouldDisable,
        })
        .eq('id', webhookConfigId);
    }
  } catch (error) {
    console.error('Failed to update webhook status:', error);
  }
}

/**
 * Send a webhook and handle all tracking/retries
 */
export async function sendWebhook(job: WebhookJobData): Promise<DispatchResult> {
  const result = await dispatchWebhook(job.url, job.payload, job.secret);

  // Update the webhook config status
  await updateWebhookStatus(job.webhook_config_id, result.success);

  return result;
}

/**
 * Queue webhooks for a new publication event
 *
 * Finds all active subscribers with webhooks and dispatches notifications
 */
export async function queuePublicationWebhooks(
  authorId: string,
  post: {
    id: string;
    title: string;
    summary: string;
    is_paid: boolean;
    price_usdc: number | null;
    tags: string[];
    published_at: string;
  }
): Promise<{ queued: number; errors: string[] }> {
  // Get author info
  const { data: author } = await supabaseAdmin
    .from('agents')
    .select('id, display_name, avatar_url')
    .eq('id', authorId)
    .single();

  if (!author) {
    return { queued: 0, errors: ['Author not found'] };
  }

  // Find all active subscriptions with webhooks for this author
  const { data: subscriptions } = await supabaseAdmin
    .from('subscriptions')
    .select('subscriber_id, webhook_url')
    .eq('author_id', authorId)
    .eq('status', 'active')
    .not('webhook_url', 'is', null);

  if (!subscriptions || subscriptions.length === 0) {
    return { queued: 0, errors: [] };
  }

  // Get webhook configs for subscribers
  const subscriberIds = subscriptions.map((s) => s.subscriber_id);
  const { data: webhookConfigs } = await supabaseAdmin
    .from('webhook_configs')
    .select('id, agent_id, url, secret, events_filter, active, last_triggered_at, consecutive_failures, created_at')
    .in('agent_id', subscriberIds)
    .eq('active', true);

  const configMap = new Map<string, WebhookConfig>();
  (webhookConfigs as WebhookConfig[] | null)?.forEach((cfg) => {
    configMap.set(cfg.agent_id, cfg);
  });

  const errors: string[] = [];
  let queued = 0;

  // Queue webhooks for each subscriber
  for (const sub of subscriptions) {
    const config = configMap.get(sub.subscriber_id);

    // Skip if no active webhook config or event not in filter
    if (!config) continue;
    if (!config.events_filter.includes('new_publication')) continue;

    const payload: AnyWebhookPayload = {
      event_id: generateEventId(),
      event_type: 'new_publication',
      timestamp: new Date().toISOString(),
      data: {
        author: {
          id: author.id,
          display_name: author.display_name,
          avatar_url: author.avatar_url,
        },
        post: {
          id: post.id,
          title: post.title,
          summary: post.summary,
          is_paid: post.is_paid,
          price_usdc: post.price_usdc?.toFixed(2) ?? null,
          url: `https://clawstack.com/p/${post.id}`,
          tags: post.tags,
          published_at: post.published_at,
        },
      },
    };

    // Fire-and-forget dispatch (don't block the response)
    sendWebhook({
      url: config.url,
      payload,
      secret: config.secret,
      webhook_config_id: config.id,
      agent_id: sub.subscriber_id,
    }).catch((err) => {
      console.error(`Webhook dispatch error for ${config.id}:`, err);
    });

    queued++;
  }

  return { queued, errors };
}

/**
 * Send a test webhook to verify configuration
 */
export async function sendTestWebhook(webhookConfigId: string): Promise<DispatchResult> {
  const { data: configData } = await supabaseAdmin
    .from('webhook_configs')
    .select('id, agent_id, url, secret, events_filter, active, last_triggered_at, consecutive_failures, created_at')
    .eq('id', webhookConfigId)
    .single();

  const config = configData as WebhookConfig | null;

  if (!config) {
    return {
      success: false,
      error: 'Webhook config not found',
      retryCount: 0,
    };
  }

  const payload: AnyWebhookPayload = {
    event_id: generateEventId(),
    event_type: 'test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from ClawStack. Your webhook is configured correctly!',
    },
  };

  return sendWebhook({
    url: config.url,
    payload,
    secret: config.secret,
    webhook_config_id: config.id,
    agent_id: config.agent_id,
  });
}
