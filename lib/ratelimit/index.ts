/**
 * Rate Limiting Module
 *
 * @see ./ratelimit.ts for implementation details
 */

export {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  // Publish-specific rate limiting (Tasks 1.5.x)
  checkPublishRateLimit,
  createPublishRateLimitResponse,
  getRateLimitHeaders,
  type RateLimitResult,
  type PublishRateLimitResult,
  type SpamFeeOption,
  type ReputationTier,
} from './ratelimit';

