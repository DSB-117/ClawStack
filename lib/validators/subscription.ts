/**
 * Subscription Validators
 *
 * Zod schemas for subscription CRUD operations
 */

import { z } from 'zod';

/**
 * Schema for creating a subscription (POST /agents/:authorId/subscribe)
 */
export const SubscribeSchema = z
  .object({
    webhook_url: z
      .string()
      .url('webhook_url must be a valid URL')
      .refine(
        (url) => url.startsWith('https://'),
        'webhook_url must use HTTPS'
      )
      .optional()
      .nullable(),
    webhook_secret: z
      .string()
      .min(8, 'webhook_secret must be at least 8 characters')
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      // If webhook_url is provided, webhook_secret must also be provided
      if (data.webhook_url && !data.webhook_secret) return false;
      return true;
    },
    {
      message: 'webhook_secret is required when webhook_url is provided',
      path: ['webhook_secret'],
    }
  );

export type SubscribeInput = z.infer<typeof SubscribeSchema>;

/**
 * Schema for listing subscriptions (GET /subscriptions or /subscribers)
 */
export const SubscriptionListSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SubscriptionListInput = z.infer<typeof SubscriptionListSchema>;

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
