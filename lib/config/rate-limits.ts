/**
 * Rate Limiting Configuration
 *
 * Defines reputation-tier based rate limits for the publish endpoint.
 *
 * @see /docs/rate-limiting.md for architecture documentation
 * @see claude/operations/tasks.md Task 1.5.3
 */

/**
 * Window duration string type for Upstash Ratelimit
 */
export type WindowString =
  | `${number} s`
  | `${number} m`
  | `${number} h`
  | `${number} d`;

/**
 * Rate limit configuration for a single tier
 */
export interface TierRateLimit {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Window duration string for Upstash (e.g., "1 h") */
  windowString: WindowString;
  /** Anti-spam fee in USDC if limit exceeded (null = no bypass option) */
  spamFeeUsdc: string | null;
}

/**
 * Reputation tier types
 */
export type ReputationTier = 'new' | 'established' | 'verified' | 'suspended';

/**
 * Rate limit configuration per reputation tier
 *
 * @see PRD Section 2.4.1 - Rate Limiting Matrix
 *
 * | Tier         | Max Requests | Window   | Spam Fee |
 * |--------------|--------------|----------|----------|
 * | new          | 1            | 30 min   | null     |
 * | established  | 1            | 30 min   | $0.10    |
 * | verified     | 4            | 1 hour   | $0.25    |
 * | suspended    | 0            | ∞        | null     |
 */
export const RATE_LIMITS: Record<ReputationTier, TierRateLimit> = {
  new: {
    maxRequests: 1,
    windowMs: 30 * 60 * 1000, // 30 minutes
    windowString: '30 m',
    spamFeeUsdc: null, // New agents must wait
  },
  established: {
    maxRequests: 1,
    windowMs: 30 * 60 * 1000, // 30 minutes
    windowString: '30 m',
    spamFeeUsdc: '0.10',
  },
  verified: {
    maxRequests: 4,
    windowMs: 60 * 60 * 1000, // 1 hour
    windowString: '1 h',
    spamFeeUsdc: '0.25',
  },
  suspended: {
    maxRequests: 0,
    windowMs: Infinity,
    windowString: '365 d', // Effectively infinite
    spamFeeUsdc: null, // Cannot bypass
  },
} as const;

/**
 * Get rate limit config for a tier
 *
 * @param tier - Agent's reputation tier
 * @returns Rate limit configuration
 */
export function getRateLimitForTier(tier: ReputationTier): TierRateLimit {
  return RATE_LIMITS[tier] ?? RATE_LIMITS.new;
}

/**
 * Check if a tier is rate-limited (max requests = 0)
 */
export function isTierSuspended(tier: ReputationTier): boolean {
  return RATE_LIMITS[tier].maxRequests === 0;
}

/**
 * Default tier for unknown/missing tier values
 */
export const DEFAULT_TIER: ReputationTier = 'new';
