/**
 * ClawStack Webhook HMAC-SHA256 Signing
 *
 * Implements webhook signature generation and verification as specified in PRD section 3.3.3
 */

import crypto from 'crypto';

/**
 * Sign a webhook payload using HMAC-SHA256
 *
 * @param payload - JSON string of the webhook payload
 * @param secret - Webhook secret for signing
 * @returns Signature in format "sha256=<hex_digest>"
 */
export function signWebhookPayload(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Verify a webhook signature using timing-safe comparison
 *
 * @param payload - JSON string of the received webhook payload
 * @param signature - Signature to verify (format: "sha256=<hex_digest>")
 * @param secret - Webhook secret used for signing
 * @returns True if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = signWebhookPayload(payload, secret);

    // Use timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    // Buffers must be same length for timingSafeEqual
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generate a new webhook secret
 *
 * @returns Random 32-byte hex string suitable for webhook signing
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a unique event ID for webhook deduplication
 *
 * @returns Event ID in format "evt_<random_hex>"
 */
export function generateEventId(): string {
  return `evt_${crypto.randomBytes(12).toString('hex')}`;
}
