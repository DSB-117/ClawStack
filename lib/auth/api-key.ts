/**
 * ClawStack API Key Management
 *
 * API Key Format Specification:
 * ============================
 * Format: `{prefix}_{environment}_{random_string}`
 *
 * Components:
 * - prefix: "csk" (ClawStack Key)
 * - environment: "live" (production) or "test" (development/testing)
 * - random_string: 32 cryptographically random alphanumeric characters
 *
 * Examples:
 * - Production: csk_live_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6
 * - Test:       csk_test_x9Y8z7W6v5U4t3S2r1Q0p9O8n7M6l5K4
 *
 * Security Notes:
 * - Keys are generated using crypto.randomBytes for cryptographic security
 * - Only the bcrypt hash of the key is stored in the database
 * - The raw key is returned ONCE at creation and cannot be recovered
 * - Test keys should only work in development/staging environments
 */

import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * API Key prefix - identifies ClawStack keys
 */
export const API_KEY_PREFIX = 'csk';

/**
 * Environment identifiers
 */
export const API_KEY_ENVIRONMENTS = {
  LIVE: 'live',
  TEST: 'test',
} as const;

export type ApiKeyEnvironment =
  (typeof API_KEY_ENVIRONMENTS)[keyof typeof API_KEY_ENVIRONMENTS];

/**
 * Length of the random portion of the API key
 */
export const API_KEY_RANDOM_LENGTH = 32;

/**
 * Characters used in API key generation (alphanumeric)
 * Using URL-safe base64 characters for compatibility
 */
const ALPHANUMERIC_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Regex pattern for validating API key format
 * Matches: csk_(live|test)_[A-Za-z0-9]{32}
 */
export const API_KEY_PATTERN =
  /^csk_(live|test)_[A-Za-z0-9]{32}$/;

/**
 * Generate a cryptographically secure random alphanumeric string
 *
 * @param length - Number of characters to generate
 * @returns Random alphanumeric string
 */
function generateRandomString(length: number): string {
  const bytes = randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    // Use modulo to map each byte to a character in our alphabet
    // This is slightly biased but acceptable for our use case
    result += ALPHANUMERIC_CHARS[bytes[i] % ALPHANUMERIC_CHARS.length];
  }

  return result;
}

/**
 * Generate a new API key
 *
 * @param environment - 'live' for production, 'test' for development
 * @returns A new API key in format: csk_{environment}_{random}
 *
 * @example
 * const key = generateApiKey('live');
 * // Returns: "csk_live_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6"
 */
export function generateApiKey(
  environment: ApiKeyEnvironment = 'live'
): string {
  const randomPart = generateRandomString(API_KEY_RANDOM_LENGTH);
  return `${API_KEY_PREFIX}_${environment}_${randomPart}`;
}

/**
 * Validate that a string matches the API key format
 *
 * This performs format validation ONLY - it does not verify
 * that the key exists or is authorized.
 *
 * @param key - String to validate
 * @returns true if the string matches API key format
 *
 * @example
 * isValidApiKeyFormat('csk_live_abc123...'); // true
 * isValidApiKeyFormat('invalid_key');        // false
 */
export function isValidApiKeyFormat(key: string): boolean {
  return API_KEY_PATTERN.test(key);
}

/**
 * Extract the environment from an API key
 *
 * @param key - API key to parse
 * @returns Environment ('live' or 'test') or null if invalid
 *
 * @example
 * getApiKeyEnvironment('csk_live_...');  // 'live'
 * getApiKeyEnvironment('csk_test_...');  // 'test'
 * getApiKeyEnvironment('invalid');       // null
 */
export function getApiKeyEnvironment(key: string): ApiKeyEnvironment | null {
  if (!isValidApiKeyFormat(key)) {
    return null;
  }

  const parts = key.split('_');
  return parts[1] as ApiKeyEnvironment;
}

/**
 * Check if an API key is a test key
 *
 * Test keys should be rejected in production environments.
 *
 * @param key - API key to check
 * @returns true if the key is a test key
 */
export function isTestKey(key: string): boolean {
  return getApiKeyEnvironment(key) === 'test';
}

/**
 * Check if an API key is a live/production key
 *
 * @param key - API key to check
 * @returns true if the key is a production key
 */
export function isLiveKey(key: string): boolean {
  return getApiKeyEnvironment(key) === 'live';
}

/**
 * Mask an API key for safe logging/display
 *
 * Shows the prefix and environment but hides most of the random part.
 *
 * @param key - API key to mask
 * @returns Masked key like "csk_live_a1B2...o5P6"
 *
 * @example
 * maskApiKey('csk_live_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6');
 * // Returns: "csk_live_a1B2...o5P6"
 */
export function maskApiKey(key: string): string {
  if (!isValidApiKeyFormat(key)) {
    return '[invalid key format]';
  }

  const parts = key.split('_');
  const prefix = `${parts[0]}_${parts[1]}_`;
  const random = parts[2];

  // Show first 4 and last 4 characters
  const masked = `${random.slice(0, 4)}...${random.slice(-4)}`;

  return `${prefix}${masked}`;
}

// ============================================================================
// API Key Hashing (for secure storage)
// ============================================================================

/**
 * Bcrypt cost factor for API key hashing
 * 10 provides good security/performance balance
 */
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Hash an API key for secure storage in the database
 *
 * IMPORTANT: Never store raw API keys. Only store the hash.
 *
 * @param key - Raw API key to hash
 * @returns Promise resolving to bcrypt hash
 *
 * @example
 * const hash = await hashApiKey('csk_live_abc123...');
 * // Store `hash` in database, discard raw key
 */
export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, BCRYPT_SALT_ROUNDS);
}

/**
 * Synchronous version of hashApiKey for use in contexts where
 * async is not available (e.g., seed scripts)
 *
 * @param key - Raw API key to hash
 * @returns Bcrypt hash
 */
export function hashApiKeySync(key: string): string {
  return bcrypt.hashSync(key, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify an API key against its stored hash
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param key - Raw API key provided by client
 * @param hash - Stored bcrypt hash from database
 * @returns Promise resolving to true if key matches hash
 *
 * @example
 * const isValid = await verifyApiKey(clientKey, storedHash);
 * if (!isValid) throw new Error('Invalid API key');
 */
export async function verifyApiKey(
  key: string,
  hash: string
): Promise<boolean> {
  // First, validate format to fail fast on obviously invalid keys
  if (!isValidApiKeyFormat(key)) {
    return false;
  }

  return bcrypt.compare(key, hash);
}

/**
 * Synchronous version of verifyApiKey
 *
 * @param key - Raw API key provided by client
 * @param hash - Stored bcrypt hash from database
 * @returns true if key matches hash
 */
export function verifyApiKeySync(key: string, hash: string): boolean {
  if (!isValidApiKeyFormat(key)) {
    return false;
  }

  return bcrypt.compareSync(key, hash);
}
