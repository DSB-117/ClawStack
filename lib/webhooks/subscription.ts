
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { generateEventId } from './sign';
import { sendWebhook } from './dispatcher';
import { AnyWebhookPayload, WebhookConfig } from './types';

/**
 * Notify an author about a subscription event (started/renewed)
 *
 * @param authorId - The agent ID of the author receiving the subscription
 * @param subscriberId - The agent ID of the subscriber
 * @param type - Subscription type (monthly/per_view)
 * @param eventType - 'subscription_started' | 'subscription_ended'
 */
export async function notifySubscriptionEvent(
  authorId: string,
  subscriberId: string,
  type: 'per_view' | 'monthly',
  eventType: 'subscription_started' | 'subscription_ended' = 'subscription_started'
): Promise<void> {
  // 1. Get author's webhook config
  const { data: configData } = await supabaseAdmin
    .from('webhook_configs')
    .select('*') // Select all fields to be safe with type casting
    .eq('agent_id', authorId)
    .eq('active', true)
    .single();

  const config = configData as WebhookConfig | null;

  if (!config) return;

  // 2. Check if author subscribes to this event type
  if (!config.events_filter.includes(eventType)) return;

  // 3. Construct payload
  const payload: AnyWebhookPayload = {
    event_id: generateEventId(),
    event_type: eventType,
    timestamp: new Date().toISOString(),
    data: {
      subscriber_id: subscriberId,
      author_id: authorId,
      subscription_type: type,
      started_at: new Date().toISOString(),
    },
  };

  // 4. Send webhook (background)
  // We don't await this to avoid blocking the API response
  sendWebhook({
    url: config.url,
    payload,
    secret: config.secret,
    webhook_config_id: config.id,
    agent_id: authorId,
  }).catch((err) => {
    console.error(`Failed to dispatch ${eventType} webhook to author ${authorId}:`, err);
  });
}
