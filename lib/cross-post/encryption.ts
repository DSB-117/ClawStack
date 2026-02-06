/**
 * Cross-Post Encryption Utilities
 *
 * Provides AES-256-GCM encryption for storing platform credentials securely.
 * Uses a master key from environment variables.
 *
 * Format: {iv_hex}:{encrypted_data_hex}:{auth_tag_hex}
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits

/**
 * Get the encryption key from environment
 * Key must be a 64-character hex string (32 bytes)
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.CROSS_POST_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      'CROSS_POST_ENCRYPTION_KEY environment variable is not set. ' +
        'Generate one with: openssl rand -hex 32'
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'CROSS_POST_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate one with: openssl rand -hex 32'
    );
  }

  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt credentials for secure storage
 *
 * @param data - Object to encrypt (e.g., { api_key: "..." })
 * @returns Encrypted string in format: {iv}:{encrypted}:{tag}
 * @throws Error if encryption key is missing or invalid
 */
export function encryptCredentials(data: object): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const plaintext = JSON.stringify(data);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:encrypted:tag
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt credentials from storage
 *
 * @param encrypted - Encrypted string in format: {iv}:{encrypted}:{tag}
 * @returns Decrypted object
 * @throws Error if decryption fails (invalid format, wrong key, tampered data)
 */
export function decryptCredentials<T = object>(encrypted: string): T {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');

  if (parts.length !== 3) {
    throw new Error(
      'Invalid encrypted credentials format. Expected: {iv}:{encrypted}:{tag}'
    );
  }

  const [ivHex, encryptedHex, tagHex] = parts;

  // Validate hex strings
  if (!/^[0-9a-fA-F]+$/.test(ivHex) ||
      !/^[0-9a-fA-F]+$/.test(encryptedHex) ||
      !/^[0-9a-fA-F]+$/.test(tagHex)) {
    throw new Error('Invalid encrypted credentials: not valid hex encoding');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const encryptedData = Buffer.from(encryptedHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
  }

  if (authTag.length !== TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${TAG_LENGTH}, got ${authTag.length}`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted: string;
  try {
    decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');
  } catch {
    // Auth tag verification failed or other decryption error
    throw new Error(
      'Failed to decrypt credentials: data may be corrupted or key is incorrect'
    );
  }

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    throw new Error('Failed to parse decrypted credentials as JSON');
  }
}

/**
 * Check if encryption is properly configured
 *
 * @returns true if CROSS_POST_ENCRYPTION_KEY is set and valid
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate encryption key format without throwing
 *
 * @returns Object with valid flag and optional error message
 */
export function validateEncryptionKey(): { valid: boolean; error?: string } {
  const keyHex = process.env.CROSS_POST_ENCRYPTION_KEY;

  if (!keyHex) {
    return {
      valid: false,
      error: 'CROSS_POST_ENCRYPTION_KEY is not set',
    };
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    return {
      valid: false,
      error: 'CROSS_POST_ENCRYPTION_KEY must be a 64-character hex string',
    };
  }

  return { valid: true };
}

/**
 * Mask an API key for display (show first 5 chars + ***)
 *
 * @param apiKey - Full API key
 * @returns Masked key like "csk_l***"
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 5) {
    return '***';
  }
  return `${apiKey.substring(0, 5)}***`;
}
