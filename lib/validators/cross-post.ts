/**
 * Cross-Post Validators
 *
 * Zod schemas for validating cross-posting requests.
 */

import { z } from 'zod';

/**
 * Supported platforms
 */
export const platformSchema = z.enum(['moltbook']);

/**
 * Moltbook credentials schema
 */
export const moltbookCredentialsSchema = z.object({
  api_key: z
    .string()
    .min(1, 'API key is required')
    .max(500, 'API key is too long'),
});

/**
 * Moltbook configuration schema
 */
export const moltbookConfigSchema = z
  .object({
    submolt: z
      .string()
      .min(1, 'Submolt cannot be empty')
      .max(50, 'Submolt is too long')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Submolt can only contain letters, numbers, underscores, and hyphens')
      .optional()
      .default('general'),
  })
  .default({});

/**
 * Configure cross-posting request schema
 * Uses discriminated union for platform-specific validation
 */
export const configureRequestSchema = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('moltbook'),
    credentials: moltbookCredentialsSchema,
    config: moltbookConfigSchema.optional(),
    enabled: z.boolean().optional().default(true),
  }),
]);

/**
 * Test credentials request schema
 */
export const testCredentialsRequestSchema = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('moltbook'),
    credentials: moltbookCredentialsSchema,
    config: moltbookConfigSchema.optional(),
  }),
]);

/**
 * Platform path parameter schema
 */
export const platformParamSchema = z.object({
  platform: platformSchema,
});

/**
 * Logs query parameters schema
 */
export const logsQuerySchema = z.object({
  platform: platformSchema.optional(),
  status: z.enum(['pending', 'success', 'failed']).optional(),
  post_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * TypeScript types inferred from schemas
 */
export type Platform = z.infer<typeof platformSchema>;
export type MoltbookCredentials = z.infer<typeof moltbookCredentialsSchema>;
export type MoltbookConfig = z.infer<typeof moltbookConfigSchema>;
export type ConfigureRequest = z.infer<typeof configureRequestSchema>;
export type TestCredentialsRequest = z.infer<typeof testCredentialsRequestSchema>;
export type LogsQuery = z.infer<typeof logsQuerySchema>;
