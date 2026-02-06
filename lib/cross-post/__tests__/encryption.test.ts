/**
 * Encryption Tests
 *
 * Tests for AES-256-GCM credential encryption.
 */

import {
  encryptCredentials,
  decryptCredentials,
  isEncryptionConfigured,
  validateEncryptionKey,
  maskApiKey,
} from '../encryption';

// Store original env value
const originalEnvKey = process.env.CROSS_POST_ENCRYPTION_KEY;

// Valid 32-byte hex key for testing
const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Encryption Utilities', () => {
  beforeEach(() => {
    // Set test encryption key
    process.env.CROSS_POST_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });

  afterEach(() => {
    // Restore original key
    process.env.CROSS_POST_ENCRYPTION_KEY = originalEnvKey;
  });

  describe('encryptCredentials', () => {
    it('should encrypt an object to a string', () => {
      const data = { api_key: 'test_key_123' };
      const encrypted = encryptCredentials(data);

      expect(typeof encrypted).toBe('string');
      expect(encrypted).toContain(':'); // Format: iv:encrypted:tag
      expect(encrypted.split(':').length).toBe(3);
    });

    it('should produce different outputs for the same input (unique IV)', () => {
      const data = { api_key: 'test_key_123' };

      const encrypted1 = encryptCredentials(data);
      const encrypted2 = encryptCredentials(data);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error if encryption key is missing', () => {
      delete process.env.CROSS_POST_ENCRYPTION_KEY;

      expect(() => encryptCredentials({ api_key: 'test' })).toThrow(
        'CROSS_POST_ENCRYPTION_KEY environment variable is not set'
      );
    });

    it('should throw error if encryption key is invalid format', () => {
      process.env.CROSS_POST_ENCRYPTION_KEY = 'invalid_key';

      expect(() => encryptCredentials({ api_key: 'test' })).toThrow(
        'CROSS_POST_ENCRYPTION_KEY must be a 64-character hex string'
      );
    });
  });

  describe('decryptCredentials', () => {
    it('should decrypt to original data', () => {
      const original = { api_key: 'my_secret_api_key_12345' };
      const encrypted = encryptCredentials(original);
      const decrypted = decryptCredentials(encrypted);

      expect(decrypted).toEqual(original);
    });

    it('should handle complex objects', () => {
      const original = {
        api_key: 'key123',
        nested: { value: 'test' },
        array: [1, 2, 3],
      };
      const encrypted = encryptCredentials(original);
      const decrypted = decryptCredentials(encrypted);

      expect(decrypted).toEqual(original);
    });

    it('should throw error on invalid format (missing parts)', () => {
      expect(() => decryptCredentials('invalid')).toThrow(
        'Invalid encrypted credentials format'
      );
    });

    it('should throw error on invalid format (not hex)', () => {
      expect(() => decryptCredentials('xxx:yyy:zzz')).toThrow(
        'Invalid encrypted credentials: not valid hex encoding'
      );
    });

    it('should throw error on invalid auth tag (tampered data)', () => {
      const encrypted = encryptCredentials({ api_key: 'test' });
      const parts = encrypted.split(':');
      // Tamper with the auth tag
      parts[2] = '00000000000000000000000000000000';
      const tampered = parts.join(':');

      expect(() => decryptCredentials(tampered)).toThrow(
        'Failed to decrypt credentials'
      );
    });
  });

  describe('isEncryptionConfigured', () => {
    it('should return true when key is set and valid', () => {
      expect(isEncryptionConfigured()).toBe(true);
    });

    it('should return false when key is missing', () => {
      delete process.env.CROSS_POST_ENCRYPTION_KEY;
      expect(isEncryptionConfigured()).toBe(false);
    });

    it('should return false when key is invalid', () => {
      process.env.CROSS_POST_ENCRYPTION_KEY = 'too_short';
      expect(isEncryptionConfigured()).toBe(false);
    });
  });

  describe('validateEncryptionKey', () => {
    it('should return valid: true for correct key', () => {
      const result = validateEncryptionKey();
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error when key is missing', () => {
      delete process.env.CROSS_POST_ENCRYPTION_KEY;
      const result = validateEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('CROSS_POST_ENCRYPTION_KEY is not set');
    });

    it('should return error when key is wrong length', () => {
      process.env.CROSS_POST_ENCRYPTION_KEY = 'abcd1234';
      const result = validateEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('CROSS_POST_ENCRYPTION_KEY must be a 64-character hex string');
    });
  });

  describe('maskApiKey', () => {
    it('should mask API key showing first 5 characters', () => {
      expect(maskApiKey('mb_api_key_12345')).toBe('mb_ap***');
    });

    it('should handle short keys', () => {
      expect(maskApiKey('abc')).toBe('***');
      expect(maskApiKey('')).toBe('***');
    });

    it('should handle exactly 5 character keys', () => {
      expect(maskApiKey('12345')).toBe('12345***');
    });
  });
});
