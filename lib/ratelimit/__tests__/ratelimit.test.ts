/**
 * Rate Limiter Tests
 *
 * Tests for the publish endpoint rate limiting system.
 *
 * @see lib/ratelimit/ratelimit.ts
 * @see claude/operations/tasks.md Task 1.5.9
 */

import {
  checkPublishRateLimit,
  createPublishRateLimitResponse,
  getRateLimitHeaders,
  type PublishRateLimitResult,
} from '../ratelimit';
import {
  RATE_LIMITS,
  getRateLimitForTier,
  isTierSuspended,
  type ReputationTier,
} from '@/lib/config/rate-limits';

// Suppress console.warn for clean test output
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Rate Limit Configuration', () => {
  describe('RATE_LIMITS', () => {
    it('defines limits for all reputation tiers', () => {
      const tiers: ReputationTier[] = ['new', 'established', 'verified', 'suspended'];
      tiers.forEach((tier) => {
        expect(RATE_LIMITS[tier]).toBeDefined();
        expect(RATE_LIMITS[tier].maxRequests).toBeDefined();
        expect(RATE_LIMITS[tier].windowMs).toBeDefined();
        expect(RATE_LIMITS[tier].windowString).toBeDefined();
      });
    });

    it('new tier allows 1 request per 2 hours', () => {
      expect(RATE_LIMITS.new.maxRequests).toBe(1);
      expect(RATE_LIMITS.new.windowMs).toBe(2 * 60 * 60 * 1000);
      expect(RATE_LIMITS.new.spamFeeUsdc).toBeNull();
    });

    it('established tier allows 1 request per hour with spam fee', () => {
      expect(RATE_LIMITS.established.maxRequests).toBe(1);
      expect(RATE_LIMITS.established.windowMs).toBe(60 * 60 * 1000);
      expect(RATE_LIMITS.established.spamFeeUsdc).toBe('0.10');
    });

    it('verified tier allows 4 requests per hour with spam fee', () => {
      expect(RATE_LIMITS.verified.maxRequests).toBe(4);
      expect(RATE_LIMITS.verified.windowMs).toBe(60 * 60 * 1000);
      expect(RATE_LIMITS.verified.spamFeeUsdc).toBe('0.25');
    });

    it('suspended tier allows 0 requests', () => {
      expect(RATE_LIMITS.suspended.maxRequests).toBe(0);
      expect(RATE_LIMITS.suspended.spamFeeUsdc).toBeNull();
    });
  });

  describe('getRateLimitForTier', () => {
    it('returns correct config for each tier', () => {
      expect(getRateLimitForTier('new')).toEqual(RATE_LIMITS.new);
      expect(getRateLimitForTier('established')).toEqual(RATE_LIMITS.established);
      expect(getRateLimitForTier('verified')).toEqual(RATE_LIMITS.verified);
      expect(getRateLimitForTier('suspended')).toEqual(RATE_LIMITS.suspended);
    });

    it('defaults to new tier for unknown tier', () => {
      // TypeScript won't allow this, but runtime might
      expect(getRateLimitForTier('unknown' as ReputationTier)).toEqual(RATE_LIMITS.new);
    });
  });

  describe('isTierSuspended', () => {
    it('returns true only for suspended tier', () => {
      expect(isTierSuspended('new')).toBe(false);
      expect(isTierSuspended('established')).toBe(false);
      expect(isTierSuspended('verified')).toBe(false);
      expect(isTierSuspended('suspended')).toBe(true);
    });
  });
});

describe('checkPublishRateLimit', () => {
  // Note: Without Redis configured, the rate limiter gracefully degrades
  // and allows all requests. These tests verify the logic structure.

  it('blocks suspended agents immediately', async () => {
    const result = await checkPublishRateLimit('agent-123', 'suspended');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.limit).toBe(0);
    expect(result.tier).toBe('suspended');
  });

  it('gracefully degrades when Redis unavailable (allows request)', async () => {
    // Without Redis configured, requests are allowed (fail-open)
    const result = await checkPublishRateLimit('agent-123', 'new');

    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('new');
    expect(result.limit).toBe(RATE_LIMITS.new.maxRequests);
    expect(result.tierConfig).toEqual(RATE_LIMITS.new);
  });

  it('returns correct tier config for verified agents', async () => {
    const result = await checkPublishRateLimit('agent-123', 'verified');

    expect(result.tier).toBe('verified');
    expect(result.tierConfig).toEqual(RATE_LIMITS.verified);
    expect(result.limit).toBe(RATE_LIMITS.verified.maxRequests);
  });

  it('returns correct tier config for established agents', async () => {
    const result = await checkPublishRateLimit('agent-123', 'established');

    expect(result.tier).toBe('established');
    expect(result.tierConfig).toEqual(RATE_LIMITS.established);
    expect(result.limit).toBe(RATE_LIMITS.established.maxRequests);
  });
});

describe('createPublishRateLimitResponse', () => {
  it('returns 429 with Retry-After header', async () => {
    const resetTime = Date.now() + 3600000; // 1 hour from now
    const result: PublishRateLimitResult = {
      allowed: false,
      remaining: 0,
      limit: 1,
      reset: resetTime,
      tier: 'established',
      tierConfig: RATE_LIMITS.established,
    };

    const response = createPublishRateLimitResponse(result);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeDefined();
    expect(response.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('includes spam_fee_option when available for tier', async () => {
    const result: PublishRateLimitResult = {
      allowed: false,
      remaining: 0,
      limit: 1,
      reset: Date.now() + 3600000,
      tier: 'established',
      tierConfig: RATE_LIMITS.established,
    };

    const response = createPublishRateLimitResponse(result);
    const body = await response.json();

    expect(body.spam_fee_option).toBeDefined();
    expect(body.spam_fee_option.fee_usdc).toBe('0.10');
    expect(body.message).toContain('Pay anti-spam fee');
  });

  it('omits spam_fee_option for new tier', async () => {
    const result: PublishRateLimitResult = {
      allowed: false,
      remaining: 0,
      limit: 1,
      reset: Date.now() + 3600000,
      tier: 'new',
      tierConfig: RATE_LIMITS.new,
    };

    const response = createPublishRateLimitResponse(result);
    const body = await response.json();

    expect(body.spam_fee_option).toBeUndefined();
    expect(body.message).toContain('Wait for the window');
  });

  it('includes verified tier spam fee', async () => {
    const result: PublishRateLimitResult = {
      allowed: false,
      remaining: 0,
      limit: 4,
      reset: Date.now() + 3600000,
      tier: 'verified',
      tierConfig: RATE_LIMITS.verified,
    };

    const response = createPublishRateLimitResponse(result);
    const body = await response.json();

    expect(body.spam_fee_option.fee_usdc).toBe('0.25');
  });
});

describe('getRateLimitHeaders', () => {
  it('returns correct headers for allowed request', () => {
    const result: PublishRateLimitResult = {
      allowed: true,
      remaining: 3,
      limit: 4,
      reset: 1706960000000,
      tier: 'verified',
      tierConfig: RATE_LIMITS.verified,
    };

    const headers = getRateLimitHeaders(result);

    expect(headers['X-RateLimit-Limit']).toBe('4');
    expect(headers['X-RateLimit-Remaining']).toBe('3');
    expect(headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('returns zero remaining when blocked', () => {
    const result: PublishRateLimitResult = {
      allowed: false,
      remaining: 0,
      limit: 1,
      reset: Date.now() + 3600000,
      tier: 'established',
      tierConfig: RATE_LIMITS.established,
    };

    const headers = getRateLimitHeaders(result);

    expect(headers['X-RateLimit-Remaining']).toBe('0');
  });
});

describe('Tier Configuration Validation', () => {
  const tiers: ReputationTier[] = ['new', 'established', 'verified'];

  it.each(tiers)('%s tier returns correct config via checkPublishRateLimit', async (tier) => {
    const result = await checkPublishRateLimit('agent-123', tier);

    expect(result.limit).toBe(RATE_LIMITS[tier].maxRequests);
    expect(result.tier).toBe(tier);
    expect(result.tierConfig).toEqual(RATE_LIMITS[tier]);
    expect(result.tierConfig.windowString).toBe(RATE_LIMITS[tier].windowString);
  });
});

