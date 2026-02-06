/**
 * Subscription Validator Tests
 *
 * Tests for the subscription validation schemas
 */

import {
  SubscribeSchema,
  SubscriptionListSchema,
  isValidUUID,
} from '../subscription';

describe('Subscription Validators', () => {
  describe('SubscribeSchema', () => {
    it('should accept valid subscription with webhook', () => {
      const valid = {
        webhook_url: 'https://example.com/webhook',
        webhook_secret: 'secret123',
      };
      const result = SubscribeSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should accept subscription without webhook (empty object)', () => {
      const valid = {};
      const result = SubscribeSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should accept subscription with null webhook values', () => {
      const valid = {
        webhook_url: null,
        webhook_secret: null,
      };
      const result = SubscribeSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject webhook_url without webhook_secret', () => {
      const invalid = {
        webhook_url: 'https://example.com/webhook',
      };
      const result = SubscribeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('webhook_secret');
      }
    });

    it('should reject invalid URL format', () => {
      const invalid = {
        webhook_url: 'not-a-url',
        webhook_secret: 'secret123',
      };
      const result = SubscribeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject non-HTTPS URL', () => {
      const invalid = {
        webhook_url: 'http://example.com/webhook',
        webhook_secret: 'secret123',
      };
      const result = SubscribeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject short webhook_secret (less than 8 chars)', () => {
      const invalid = {
        webhook_url: 'https://example.com/webhook',
        webhook_secret: 'short',
      };
      const result = SubscribeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should accept webhook_secret with exactly 8 characters', () => {
      const valid = {
        webhook_url: 'https://example.com/webhook',
        webhook_secret: '12345678',
      };
      const result = SubscribeSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should accept long webhook_secret', () => {
      const valid = {
        webhook_url: 'https://example.com/webhook',
        webhook_secret: 'a'.repeat(100),
      };
      const result = SubscribeSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('SubscriptionListSchema', () => {
    it('should accept valid query params', () => {
      const valid = {
        status: 'active',
        limit: '50',
        offset: '0',
      };
      const result = SubscriptionListSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('active');
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should use default values when not provided', () => {
      const result = SubscriptionListSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
        expect(result.data.status).toBeUndefined();
      }
    });

    it('should accept all valid status values', () => {
      const statuses = ['active', 'paused', 'cancelled'];
      for (const status of statuses) {
        const result = SubscriptionListSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status value', () => {
      const invalid = { status: 'invalid' };
      const result = SubscriptionListSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject limit less than 1', () => {
      const invalid = { limit: '0' };
      const result = SubscriptionListSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
      const invalid = { limit: '101' };
      const result = SubscriptionListSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should accept limit at boundary values', () => {
      const min = SubscriptionListSchema.safeParse({ limit: '1' });
      const max = SubscriptionListSchema.safeParse({ limit: '100' });
      expect(min.success).toBe(true);
      expect(max.success).toBe(true);
    });

    it('should reject negative offset', () => {
      const invalid = { offset: '-1' };
      const result = SubscriptionListSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should coerce string numbers to integers', () => {
      const result = SubscriptionListSchema.safeParse({
        limit: '25',
        offset: '10',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.limit).toBe('number');
        expect(typeof result.data.offset).toBe('number');
      }
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUID v4', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      ];

      for (const uuid of validUUIDs) {
        expect(isValidUUID(uuid)).toBe(true);
      }
    });

    it('should return false for invalid UUIDs', () => {
      const invalidUUIDs = [
        '',
        'not-a-uuid',
        '123456789',
        '123e4567-e89b-12d3-a456', // too short
        '123e4567-e89b-12d3-a456-426614174000-extra', // too long
        '123e4567e89b12d3a456426614174000', // no dashes
        'ZZZZZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZZZZZZZZZ', // invalid characters
      ];

      for (const uuid of invalidUUIDs) {
        expect(isValidUUID(uuid)).toBe(false);
      }
    });

    it('should be case-insensitive', () => {
      const lowerCase = '123e4567-e89b-12d3-a456-426614174000';
      const upperCase = '123E4567-E89B-12D3-A456-426614174000';
      const mixedCase = '123E4567-e89b-12D3-a456-426614174000';

      expect(isValidUUID(lowerCase)).toBe(true);
      expect(isValidUUID(upperCase)).toBe(true);
      expect(isValidUUID(mixedCase)).toBe(true);
    });
  });
});
