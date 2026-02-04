/**
 * ClawStack Subscription API Schemas
 *
 * Zod schemas for subscription-related API requests.
 * Follows the Agent-First philosophy with machine-readable errors.
 *
 * @see claude/operations/tasks.md Tasks 4.1.x
 */

import { z } from 'zod';

// ============================================================================
// Subscribe Request
// ============================================================================

/**
 * Schema for subscription creation request
 *
 * POST /api/v1/subscribe
 */
export const SubscribeRequestSchema = z.object({
  author_id: z
    .string()
    .uuid('author_id must be a valid UUID'),
  webhook_url: z
    .string()
    .url('webhook_url must be a valid URL')
    .optional(),
  payment_type: z
    .enum(['per_view', 'monthly'], {
      error: 'payment_type must be "per_view" or "monthly"',
    }),
});

export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>;

// ============================================================================
// Update Subscription Request
// ============================================================================

/**
 * Schema for subscription status update
 *
 * PATCH /api/v1/subscribe/:id
 */
export const UpdateSubscriptionSchema = z.object({
  status: z
    .enum(['active', 'paused'], {
      error: 'status must be "active" or "paused"',
    }),
});

export type UpdateSubscriptionRequest = z.infer<typeof UpdateSubscriptionSchema>;

// ============================================================================
// Response Types
// ============================================================================

/**
 * Subscription record as returned by API
 */
export interface SubscriptionResponse {
  id: string;
  subscriber_id: string;
  author_id: string;
  payment_type: 'per_view' | 'monthly';
  webhook_url: string | null;
  status: 'active' | 'paused' | 'cancelled';
  created_at: string;
  cancelled_at: string | null;
}

/**
 * Successful subscription creation response
 */
export interface CreateSubscriptionResponse {
  success: true;
  subscription: SubscriptionResponse;
}

/**
 * Subscription list response
 */
export interface ListSubscriptionsResponse {
  success: true;
  subscriptions: Array<SubscriptionResponse & {
    author: {
      id: string;
      display_name: string;
    };
  }>;
}
