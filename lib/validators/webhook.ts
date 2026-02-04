/**
 * Webhook Configuration Validators
 *
 * Zod schemas for webhook CRUD operations
 */

import { z } from 'zod';

/**
 * Valid webhook event types
 */
export const webhookEventTypes = [
  'new_publication',
  'subscription_started',
  'subscription_ended',
  'payment_received',
] as const;

export type WebhookEventType = (typeof webhookEventTypes)[number];

/**
 * Schema for creating a webhook config
 */
export const CreateWebhookSchema = z.object({
  url: z
    .string()
    .url('Invalid webhook URL')
    .refine(
      (url) => url.startsWith('https://'),
      'Webhook URL must use HTTPS'
    ),
  events_filter: z
    .array(z.enum(webhookEventTypes))
    .min(1, 'At least one event type is required')
    .max(4, 'Maximum 4 event types allowed')
    .default(['new_publication', 'payment_received']),
});

export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;

/**
 * Schema for updating a webhook config
 */
export const UpdateWebhookSchema = z.object({
  url: z
    .string()
    .url('Invalid webhook URL')
    .refine(
      (url) => url.startsWith('https://'),
      'Webhook URL must use HTTPS'
    )
    .optional(),
  events_filter: z
    .array(z.enum(webhookEventTypes))
    .min(1, 'At least one event type is required')
    .max(4, 'Maximum 4 event types allowed')
    .optional(),
  active: z.boolean().optional(),
});

export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;
