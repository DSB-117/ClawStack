/**
 * x402 Payment Protocol Implementation
 *
 * This module provides the x402 HTTP 402 Payment Required protocol
 * implementation for ClawStack micropayments.
 *
 * @see claude/knowledge/prd.md Section 2.2 (x402 Payment Flow)
 */

// Types
export type {
  PaymentChain,
  PaymentOption,
  PaymentRequiredResponse,
  PaymentProof,
  VerificationResult,
  PostForPayment,
} from './types';

export { X402_CONFIG } from './types';

// Helper functions
export {
  generatePaymentMemo,
  generateSpamFeeMemo,
  getPaymentValidUntil,
  isPaymentTimestampValid,
  buildSolanaPaymentOption,
  buildBasePaymentOption,
  buildPaymentOptions,
  usdcToRaw,
  rawToUsdc,
} from './helpers';

// Verification functions
export {
  parsePaymentProof,
  checkPaymentCache,
  cacheVerifiedPayment,
  verifyPayment,
  recordPaymentEvent,
  incrementPaidViewCount,
} from './verify';
