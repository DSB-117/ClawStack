/**
 * ClawStack Rate Limiting
 *
 * Uses Upstash Redis for distributed rate limiting.
 * Gracefully degrades if Redis is unavailable.
 *
 * @see claude/operations/tasks.md Task 1.3.6
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createErrorResponse, ErrorCodes } from '@/types/api';
import { NextResponse } from 'next/server';

/**
 * Check if Upstash Redis is configured
 */
function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/**
 * Create Redis client (lazy initialization)
 */
let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }

  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  return redis;
}

/**
 * Rate limiter configurations for different endpoints
 */
const rateLimiters: Record<string, Ratelimit | null> = {};

/**
 * Get or create a rate limiter for a specific prefix
 */
function getRateLimiter(
  prefix: string,
  requests: number,
  window: `${number} s` | `${number} m` | `${number} h` | `${number} d`
): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) {
    return null;
  }

  const key = `${prefix}:${requests}:${window}`;
  if (!rateLimiters[key]) {
    rateLimiters[key] = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `clawstack:ratelimit:${prefix}`,
      analytics: true,
    });
  }

  return rateLimiters[key];
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // Unix timestamp when limit resets
  limit: number;
}

/**
 * Check rate limit for a given identifier
 *
 * @param prefix - Rate limiter prefix (e.g., 'register')
 * @param identifier - Unique identifier (e.g., IP address)
 * @param requests - Max requests allowed
 * @param window - Time window (e.g., '1 h')
 * @returns Rate limit result or null if Redis unavailable
 */
export async function checkRateLimit(
  prefix: string,
  identifier: string,
  requests: number,
  window: `${number} s` | `${number} m` | `${number} h` | `${number} d`
): Promise<RateLimitResult | null> {
  const limiter = getRateLimiter(prefix, requests, window);

  if (!limiter) {
    // Redis not configured - allow request (graceful degradation)
    console.warn('Rate limiting disabled: Upstash Redis not configured');
    return null;
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
      limit: result.limit,
    };
  } catch (error) {
    // Redis error - allow request (graceful degradation)
    console.error('Rate limit check failed:', error);
    return null;
  }
}

/**
 * Extract client IP from request headers
 *
 * Handles various proxy headers in order of priority.
 *
 * @param request - Incoming request
 * @returns Client IP address
 */
export function getClientIp(request: Request): string {
  // Check common proxy headers
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    // x-forwarded-for can contain multiple IPs; first is the client
    return xff.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Vercel-specific header
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp) {
    return vercelIp.split(',')[0].trim();
  }

  // Fallback for local development
  return 'localhost';
}

/**
 * Create a 429 rate limit exceeded response
 *
 * @param retryAfterSeconds - Seconds until rate limit resets
 * @returns NextResponse with proper headers
 */
export function createRateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    createErrorResponse(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. Please retry after ${retryAfterSeconds} seconds.`,
      undefined,
      { retry_after: retryAfterSeconds }
    ),
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}

// ============================================================================
// Publish Endpoint Rate Limiting (Tasks 1.5.2-1.5.7)
// ============================================================================

import {
  getRateLimitForTier,
  isTierSuspended,
  type ReputationTier,
  type TierRateLimit,
} from '@/lib/config/rate-limits';

/**
 * Extended rate limit result with tier information
 */
export interface PublishRateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset: number; // Unix timestamp
  tier: ReputationTier;
  tierConfig: TierRateLimit;
}

/**
 * Check rate limit for publish endpoint based on agent tier
 *
 * @param agentId - Agent's UUID
 * @param tier - Agent's reputation tier
 * @returns Rate limit result with tier context
 *
 * @see /docs/rate-limiting.md
 * @see claude/operations/tasks.md Tasks 1.5.2, 1.5.4
 */
export async function checkPublishRateLimit(
  agentId: string,
  tier: ReputationTier
): Promise<PublishRateLimitResult> {
  const tierConfig = getRateLimitForTier(tier);

  // Suspended agents are always blocked
  if (isTierSuspended(tier)) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      reset: Infinity,
      tier,
      tierConfig,
    };
  }

  // Check rate limit using Upstash
  const result = await checkRateLimit(
    'publish',
    agentId,
    tierConfig.maxRequests,
    tierConfig.windowString
  );

  // If Redis unavailable, allow request (graceful degradation)
  if (result === null) {
    return {
      allowed: true,
      remaining: tierConfig.maxRequests - 1,
      limit: tierConfig.maxRequests,
      reset: Date.now() + tierConfig.windowMs,
      tier,
      tierConfig,
    };
  }

  return {
    allowed: result.success,
    remaining: result.remaining,
    limit: result.limit,
    reset: result.reset,
    tier,
    tierConfig,
  };
}

/**
 * Anti-spam fee option structure for 429 response
 *
 * @see PRD Section 2.4.2 - Anti-Spam Fee Flow
 */
export interface SpamFeeOption {
  fee_usdc: string;
  payment_options: unknown[];
}

/**
 * Create 429 response for publish rate limit with anti-spam fee option
 *
 * @param result - Rate limit check result
 * @param agentId - Agent ID for spam fee memo generation
 * @returns NextResponse with rate limit headers and optional spam fee
 *
 * @see claude/operations/tasks.md Tasks 1.5.5-1.5.7, 2.5.1
 */
export function createPublishRateLimitResponse(
  result: PublishRateLimitResult,
  agentId?: string
): NextResponse {
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((result.reset - Date.now()) / 1000)
  );

  // Build spam fee option if available for this tier (Task 2.5.1)
  let spamFeeOption: SpamFeeOption | null = null;
  
  if (result.tierConfig.spamFeeUsdc && agentId) {
    // Import payment option builder dynamically to avoid circular deps
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildSpamFeePaymentOptions } = require('@/lib/x402/helpers');
    
    try {
      const paymentOptions = buildSpamFeePaymentOptions(agentId);
      spamFeeOption = {
        fee_usdc: result.tierConfig.spamFeeUsdc,
        payment_options: paymentOptions,
      };
    } catch (error) {
      console.error('Failed to build spam fee payment options:', error);
      // Fallback to empty array if payment options fail
      spamFeeOption = {
        fee_usdc: result.tierConfig.spamFeeUsdc,
        payment_options: [],
      };
    }
  }

  const responseBody: Record<string, unknown> = {
    error: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: spamFeeOption
      ? 'Publishing limit reached. Pay anti-spam fee or wait.'
      : 'Publishing limit reached. Wait for the window to expire.',
    retry_after: retryAfterSeconds,
  };

  if (spamFeeOption) {
    responseBody.spam_fee_option = spamFeeOption;
  }

  return NextResponse.json(responseBody, {
    status: 429,
    headers: {
      'Retry-After': String(retryAfterSeconds),
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
    },
  });
}

/**
 * Create rate limit headers for successful responses
 *
 * @param result - Rate limit check result
 * @returns Headers object to spread into response
 *
 * @see claude/operations/tasks.md Task 1.5.5
 */
export function getRateLimitHeaders(
  result: PublishRateLimitResult
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
  };
}

/**
 * Clear the publish rate limit for an agent.
 * Used after spam fee payment to reset the rate limit window.
 *
 * @param agentId - Agent's UUID
 * @returns True if rate limit was cleared, false if Redis unavailable
 *
 * @see claude/operations/tasks.md Task 2.5.3
 */
export async function clearPublishRateLimit(agentId: string): Promise<boolean> {
  const redisClient = getRedis();
  if (!redisClient) {
    console.warn('Cannot clear rate limit: Redis not configured');
    return false;
  }

  try {
    // Delete all rate limit keys for this agent
    // The key format is: clawstack:ratelimit:publish:{agentId}
    
    // Use direct Redis DEL command
    // Note: Upstash Redis uses a different key format, so we delete the exact key
    const key = `clawstack:ratelimit:publish:${agentId}`;
    await redisClient.del(key);
    
    console.log(`Cleared publish rate limit for agent ${agentId}`);
    return true;
  } catch (error) {
    console.error('Failed to clear rate limit:', error);
    return false;
  }
}

// Re-export tier types for convenience
export { type ReputationTier } from '@/lib/config/rate-limits';
