/**
 * Publish Post Validator
 *
 * Zod schema for validating POST /api/v1/publish requests.
 * Enforces all content publishing rules from the PRD.
 *
 * @see claude/operations/tasks.md Tasks 1.4.2-1.4.6
 * @see claude/knowledge/prd.md Section 3.1 (Skill.md spec)
 */

import { z } from 'zod';

/**
 * Price range constants (from PRD Section 2.3.3)
 */
export const MIN_PRICE_USDC = 0.05;
export const MAX_PRICE_USDC = 0.99;

/**
 * Content limits
 */
export const MAX_TITLE_LENGTH = 200;
export const MAX_TAG_LENGTH = 50;
export const MAX_TAGS_COUNT = 5;

/**
 * Schema for publishing a new post
 *
 * Validation rules:
 * - title: required, 1-200 chars
 * - content: required, non-empty
 * - is_paid: optional boolean, defaults to false
 * - price_usdc: required if is_paid=true, must be "X.XX" format, range 0.05-0.99
 * - tags: optional array, max 5 items, each max 50 chars
 */
export const PublishPostSchema = z
  .object({
    title: z
      .string()
      .min(1, 'title is required')
      .max(MAX_TITLE_LENGTH, `title must be ${MAX_TITLE_LENGTH} characters or less`)
      .trim(),

    content: z
      .string()
      .min(1, 'content is required'),

    is_paid: z.boolean().default(false),

    price_usdc: z
      .string()
      .regex(
        /^\d+\.\d{2}$/,
        'price_usdc must be in format "X.XX" (e.g., "0.25")'
      )
      .optional(),

    tags: z
      .array(
        z
          .string()
          .max(MAX_TAG_LENGTH, `each tag must be ${MAX_TAG_LENGTH} characters or less`)
      )
      .max(MAX_TAGS_COUNT, `maximum ${MAX_TAGS_COUNT} tags allowed`)
      .default([]),
  })
  // Cross-field validation: price required for paid posts
  .refine(
    (data) => {
      if (!data.is_paid) return true;
      return data.price_usdc !== undefined && data.price_usdc !== '';
    },
    {
      message: 'price_usdc is required when is_paid is true',
      path: ['price_usdc'],
    }
  )
  // Price range validation
  .refine(
    (data) => {
      if (!data.is_paid || !data.price_usdc) return true;

      const price = parseFloat(data.price_usdc);
      return price >= MIN_PRICE_USDC && price <= MAX_PRICE_USDC;
    },
    {
      message: `price_usdc must be between ${MIN_PRICE_USDC} and ${MAX_PRICE_USDC} USDC`,
      path: ['price_usdc'],
    }
  );

/**
 * TypeScript type inferred from schema
 */
export type PublishPostInput = z.infer<typeof PublishPostSchema>;

/**
 * Normalize tags for storage
 *
 * - Converts to lowercase
 * - Trims whitespace
 * - Removes duplicates
 * - Filters empty strings
 *
 * @param tags - Raw tags from input
 * @returns Normalized tags array
 */
export function normalizeTags(tags: string[]): string[] {
  const normalized = tags
    .map((tag) => tag.toLowerCase().trim())
    .filter((tag) => tag.length > 0);

  // Remove duplicates
  return [...new Set(normalized)];
}
