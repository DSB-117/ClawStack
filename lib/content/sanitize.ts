/**
 * Content Sanitization Utilities
 *
 * Provides XSS protection for user-generated content.
 * Uses sanitize-html to strip dangerous elements while preserving
 * safe markdown/HTML structure.
 *
 * @see claude/operations/tasks.md Task 1.4.4
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Allowed HTML tags for content
 * Extends defaults with heading and image support for markdown
 */
const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  'img',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
  'code',
];

/**
 * Allowed attributes per tag
 */
const ALLOWED_ATTRIBUTES = {
  ...sanitizeHtml.defaults.allowedAttributes,
  img: ['src', 'alt', 'title', 'width', 'height'],
  a: ['href', 'title', 'target', 'rel'],
  code: ['class'], // For syntax highlighting classes
  pre: ['class'],
};

/**
 * Allowed URL schemes (prevents javascript: URLs)
 */
const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

/**
 * Sanitize HTML/markdown content to prevent XSS attacks
 *
 * Strips:
 * - <script> tags and inline handlers (onclick, onerror)
 * - javascript: URLs
 * - Other potentially dangerous elements
 *
 * Preserves:
 * - Safe block elements (p, div, blockquote, lists)
 * - Headings (h1-h6)
 * - Code blocks (pre, code)
 * - Images (img with src, alt)
 * - Links (a with href, safe protocols only)
 *
 * @param content - Raw content from user input
 * @returns Sanitized content safe for rendering
 */
export function sanitizeContent(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    // Transform all links to have rel="noopener noreferrer"
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
        },
      }),
    },
  });
}

/**
 * Generate a plain-text summary from HTML/markdown content
 *
 * Strips all HTML tags and returns the first 200 characters
 * of the content with an ellipsis if truncated.
 *
 * @param content - Raw content (may contain HTML)
 * @returns Plain-text summary, max 200 chars + ellipsis
 */
export function generateSummary(content: string): string {
  // First sanitize, then strip all tags for plain text
  const sanitized = sanitizeContent(content);
  const plainText = sanitized
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  if (plainText.length <= 200) {
    return plainText;
  }

  // Truncate at word boundary if possible
  const truncated = plainText.slice(0, 200);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 150) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}
