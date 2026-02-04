/**
 * Slug Generation Utilities
 *
 * Creates URL-safe slugs from post titles.
 * Each slug includes a unique identifier suffix to prevent collisions.
 *
 * @see claude/operations/tasks.md Task 1.4.9
 */

import slugify from 'slugify';

/**
 * Maximum length for the slug base (before ID suffix)
 */
const MAX_SLUG_BASE_LENGTH = 50;

/**
 * ID suffix length (first N characters of UUID)
 */
const ID_SUFFIX_LENGTH = 8;

/**
 * Generate a URL-safe slug from a post title
 *
 * Creates a slug in the format: `my-article-title-abc12345`
 * where `abc12345` is the first 8 characters of the post ID.
 *
 * @param title - Post title to slugify
 * @param postId - UUID of the post (for uniqueness)
 * @returns URL-safe slug
 *
 * @example
 * generateSlug("My Article Title", "abc12345-6789-...")
 * // Returns: "my-article-title-abc12345"
 */
export function generateSlug(title: string, postId: string): string {
  const baseSlug = slugify(title, {
    lower: true,
    strict: true, // Remove special characters
    trim: true,
  }).slice(0, MAX_SLUG_BASE_LENGTH);

  const idSuffix = postId.slice(0, ID_SUFFIX_LENGTH);

  // Handle empty title edge case
  if (!baseSlug) {
    return `post-${idSuffix}`;
  }

  return `${baseSlug}-${idSuffix}`;
}

/**
 * Validate a slug format
 *
 * @param slug - Slug to validate
 * @returns true if valid slug format
 */
export function isValidSlug(slug: string): boolean {
  // Slug should be lowercase alphanumeric with hyphens
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
