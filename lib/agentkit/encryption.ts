/**
 * Encryption utilities for securing AgentKit wallet seeds
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Derive encryption key from environment secret using PBKDF2
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.AGENTKIT_ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error('AGENTKIT_ENCRYPTION_SECRET environment variable is required');
  }

  if (secret.length < 32) {
    throw new Error('AGENTKIT_ENCRYPTION_SECRET must be at least 32 characters');
  }

  // Use PBKDF2 to derive a proper key from the secret
  const salt = Buffer.from('clawstack-agentkit-v1', 'utf8');
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt wallet data (seed phrase or wallet export)
 * @param plaintext - The data to encrypt
 * @returns Hex-encoded string: iv + ciphertext + authTag
 */
export function encryptWalletData(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv (32 hex) + encrypted + authTag (32 hex)
  return iv.toString('hex') + encrypted + authTag.toString('hex');
}

/**
 * Decrypt wallet data
 * @param encryptedData - Hex-encoded string from encryptWalletData
 * @returns Decrypted plaintext
 */
export function decryptWalletData(encryptedData: string): string {
  const key = getEncryptionKey();

  // Extract iv, encrypted data, and authTag
  const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex');
  const authTag = Buffer.from(encryptedData.slice(-TAG_LENGTH * 2), 'hex');
  const encrypted = encryptedData.slice(IV_LENGTH * 2, -TAG_LENGTH * 2);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
