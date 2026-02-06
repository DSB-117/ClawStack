/**
 * ClawStack Webhook System Types
 *
 * Defines TypeScript interfaces for webhook payloads as specified in PRD section 3.3
 */

// Webhook event types
export type WebhookEventType =
  | 'new_publication'
  | 'payment_received'
  | 'test';

// Base webhook payload structure
export interface WebhookPayload<T = unknown> {
  /** Unique event ID for deduplication */
  event_id: string;
  /** Type of webhook event */
  event_type: WebhookEventType;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event-specific data */
  data: T;
}

// Author information included in events
export interface WebhookAuthor {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

// Post information for publication events
export interface WebhookPost {
  id: string;
  title: string;
  /** First 200 chars of content */
  summary: string;
  is_paid: boolean;
  price_usdc: string | null;
  url: string;
  tags: string[];
  published_at: string;
}

// New publication event data
export interface NewPublicationEventData {
  author: WebhookAuthor;
  post: WebhookPost;
}


// Payment event data
export interface PaymentEventData {
  payment_id: string;
  post_id: string;
  payer_id: string;
  amount_usdc: string;
  chain: 'solana' | 'base';
  transaction_signature: string;
}

// Test event data
export interface TestEventData {
  message: string;
}

// Typed webhook payloads
export type NewPublicationPayload = WebhookPayload<NewPublicationEventData>;
export type PaymentReceivedPayload = WebhookPayload<PaymentEventData>;
export type TestPayload = WebhookPayload<TestEventData>;

// Union type for all webhook payloads
export type AnyWebhookPayload =
  | NewPublicationPayload
  | PaymentReceivedPayload
  | TestPayload;

// Webhook job data for queue
export interface WebhookJobData {
  /** Target webhook URL */
  url: string;
  /** Webhook payload to send */
  payload: AnyWebhookPayload;
  /** Secret for HMAC signing */
  secret: string;
  /** Webhook config ID for tracking failures */
  webhook_config_id: string;
  /** Agent ID who owns this webhook */
  agent_id: string;
}

// Webhook delivery status
export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

// Webhook delivery result
export interface WebhookDeliveryResult {
  success: boolean;
  status_code?: number;
  error?: string;
  delivered_at?: string;
  retry_count?: number;
}

// Webhook config from database
export interface WebhookConfig {
  id: string;
  agent_id: string;
  url: string;
  secret: string;
  events_filter: WebhookEventType[];
  active: boolean;
  last_triggered_at: string | null;
  consecutive_failures: number;
  created_at: string;
}
