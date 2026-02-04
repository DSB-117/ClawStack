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
