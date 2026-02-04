/**
 * Spam Fee Payment Flow Tests
 *
 * Tests the complete spam fee payment flow:
 * 1. Agent hits rate limit → receives 429 with payment options
 * 2. Agent pays spam fee on Solana
 * 3. Agent includes payment proof in next publish request
 * 4. Rate limit is cleared and publish succeeds
 *
 * @see claude/operations/tasks.md Task 2.5.5
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  verifySpamFeePayment,
  recordSpamFeePayment,
  parsePaymentProof,
} from '../verify';
import { buildSpamFeePaymentOptions, generateSpamFeeMemo } from '../helpers';
import type { PaymentProof, VerificationResult } from '../types';

// Mock Solana verification
jest.mock('@/lib/solana/verify', () => ({
  verifyPayment: jest.fn(),
  PaymentVerificationError: class PaymentVerificationError extends Error {
    code: string;
    constructor(message: string, code = 'VERIFICATION_FAILED') {
      super(message);
      this.code = code;
      this.name = 'PaymentVerificationError';
    }
  },
}));

// Mock Supabase
jest.mock('@/lib/db/supabase-server', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: 'payment-event-123' },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

describe('Spam Fee Payment Flow', () => {
  const mockAgentId = 'agent-123';
  const mockSpamFeeUsdc = '0.10';
  const mockTxSignature = '5xK3vSpamFee123456789abcdefghijklmnopqrstuvwxyz';
  const mockPayerAddress = '7sK9xPayerAddress123456789abcdefghijklmnop';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.SOLANA_TREASURY_PUBKEY = 'CStkPay111111111111111111111111111111111111';
    process.env.USDC_MINT_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  });

  describe('buildSpamFeePaymentOptions', () => {
    it('should build Solana payment option with spam_fee memo', () => {
      const options = buildSpamFeePaymentOptions(mockAgentId);

      expect(options).toHaveLength(1);
      expect(options[0]).toMatchObject({
        chain: 'solana',
        chain_id: 'mainnet-beta',
        recipient: process.env.SOLANA_TREASURY_PUBKEY,
        token_mint: process.env.USDC_MINT_SOLANA,
        token_symbol: 'USDC',
        decimals: 6,
      });

      // Verify memo format: clawstack:spam_fee:{agentId}:{timestamp}
      expect(options[0].memo).toMatch(/^clawstack:spam_fee:agent-123:\d+$/);
    });

    it('should throw error if Solana env vars not configured', () => {
      delete process.env.SOLANA_TREASURY_PUBKEY;

      expect(() => buildSpamFeePaymentOptions(mockAgentId)).toThrow();
    });
  });

  describe('generateSpamFeeMemo', () => {
    it('should generate memo with correct format', () => {
      const memo = generateSpamFeeMemo(mockAgentId);

      expect(memo).toMatch(/^clawstack:spam_fee:agent-123:\d+$/);
    });

    it('should include current timestamp', () => {
      const beforeTimestamp = Math.floor(Date.now() / 1000);
      const memo = generateSpamFeeMemo(mockAgentId);
      const afterTimestamp = Math.floor(Date.now() / 1000);

      const parts = memo.split(':');
      const memoTimestamp = parseInt(parts[3]);

      expect(memoTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(memoTimestamp).toBeLessThanOrEqual(afterTimestamp);
    });
  });

  describe('parsePaymentProof', () => {
    it('should parse valid payment proof header', () => {
      const header = JSON.stringify({
        chain: 'solana',
        transaction_signature: mockTxSignature,
        payer_address: mockPayerAddress,
        timestamp: 1706960000,
      });

      const proof = parsePaymentProof(header);

      expect(proof).toMatchObject({
        chain: 'solana',
        transaction_signature: mockTxSignature,
        payer_address: mockPayerAddress,
        timestamp: 1706960000,
      });
    });

    it('should return null for invalid JSON', () => {
      const proof = parsePaymentProof('invalid json');
      expect(proof).toBeNull();
    });

    it('should return null for missing required fields', () => {
      const header = JSON.stringify({
        chain: 'solana',
        // missing transaction_signature
      });

      const proof = parsePaymentProof(header);
      expect(proof).toBeNull();
    });

    it('should return null for unsupported chain', () => {
      const header = JSON.stringify({
        chain: 'ethereum',
        transaction_signature: mockTxSignature,
        payer_address: mockPayerAddress,
      });

      const proof = parsePaymentProof(header);
      expect(proof).toBeNull();
    });
  });

  describe('verifySpamFeePayment', () => {
    it('should verify valid spam fee payment', async () => {
      const { verifyPayment: mockVerifySolanaPayment } = require('@/lib/solana/verify');
      
      mockVerifySolanaPayment.mockResolvedValue({
        signature: mockTxSignature,
        payer: mockPayerAddress,
        recipient: process.env.SOLANA_TREASURY_PUBKEY,
        amount: BigInt(100000), // 0.10 USDC in raw units
      });

      const proof: PaymentProof = {
        chain: 'solana',
        transaction_signature: mockTxSignature,
        payer_address: mockPayerAddress,
        timestamp: Math.floor(Date.now() / 1000),
      };

      const result = await verifySpamFeePayment(proof, mockAgentId, mockSpamFeeUsdc);

      expect(result.success).toBe(true);
      expect(result.payment).toBeDefined();
      expect(result.payment?.signature).toBe(mockTxSignature);
      expect(result.payment?.network).toBe('solana');
    });

    it('should fail verification for insufficient payment', async () => {
      const { verifyPayment: mockVerifySolanaPayment, PaymentVerificationError } = require('@/lib/solana/verify');
      
      mockVerifySolanaPayment.mockRejectedValue(
        new PaymentVerificationError('Insufficient payment amount', 'INSUFFICIENT_AMOUNT')
      );

      const proof: PaymentProof = {
        chain: 'solana',
        transaction_signature: mockTxSignature,
        payer_address: mockPayerAddress,
        timestamp: Math.floor(Date.now() / 1000),
      };

      const result = await verifySpamFeePayment(proof, mockAgentId, mockSpamFeeUsdc);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient payment');
      expect(result.error_code).toBe('INSUFFICIENT_AMOUNT');
    });

    it('should return error for Base payments (not yet implemented)', async () => {
      const proof: PaymentProof = {
        chain: 'base',
        transaction_signature: '0xabcdef123456',
        payer_address: '0x1234567890abcdef',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const result = await verifySpamFeePayment(proof, mockAgentId, mockSpamFeeUsdc);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not yet implemented');
    });
  });

  describe('recordSpamFeePayment', () => {
    it('should record spam fee payment with 100% platform fee', async () => {
      const { supabaseAdmin } = require('@/lib/db/supabase-server');
      
      const proof: PaymentProof = {
        chain: 'solana',
        transaction_signature: mockTxSignature,
        payer_address: mockPayerAddress,
        timestamp: Math.floor(Date.now() / 1000),
      };

      const verificationResult: VerificationResult = {
        success: true,
        payment: {
          signature: mockTxSignature,
          payer: mockPayerAddress,
          recipient: process.env.SOLANA_TREASURY_PUBKEY!,
          amount_raw: BigInt(100000), // 0.10 USDC
          amount_usdc: '0.10',
          network: 'solana',
          chain_id: 'mainnet-beta',
        },
      };

      const paymentId = await recordSpamFeePayment(proof, mockAgentId, verificationResult);

      expect(paymentId).toBe('payment-event-123');
      expect(supabaseAdmin.from).toHaveBeenCalledWith('payment_events');
      
      const insertCall = supabaseAdmin.from().insert;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: 'spam_fee',
          resource_id: mockAgentId,
          network: 'solana',
          transaction_signature: mockTxSignature,
          gross_amount_raw: 100000,
          platform_fee_raw: 100000, // 100% to platform
          author_amount_raw: 0, // 0% to author
          status: 'confirmed',
        })
      );
    });

    it('should return null for failed verification result', async () => {
      const proof: PaymentProof = {
        chain: 'solana',
        transaction_signature: mockTxSignature,
        payer_address: mockPayerAddress,
        timestamp: Math.floor(Date.now() / 1000),
      };

      const verificationResult: VerificationResult = {
        success: false,
        error: 'Payment verification failed',
        error_code: 'VERIFICATION_FAILED',
      };

      const paymentId = await recordSpamFeePayment(proof, mockAgentId, verificationResult);

      expect(paymentId).toBeNull();
    });

    it('should handle duplicate payment (already recorded)', async () => {
      const { supabaseAdmin } = require('@/lib/db/supabase-server');
      
      // Mock unique constraint violation
      supabaseAdmin.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: { code: '23505' }, // Unique constraint violation
            })),
          })),
        })),
      });

      const proof: PaymentProof = {
        chain: 'solana',
        transaction_signature: mockTxSignature,
        payer_address: mockPayerAddress,
        timestamp: Math.floor(Date.now() / 1000),
      };

      const verificationResult: VerificationResult = {
        success: true,
        payment: {
          signature: mockTxSignature,
          payer: mockPayerAddress,
          recipient: process.env.SOLANA_TREASURY_PUBKEY!,
          amount_raw: BigInt(100000),
          amount_usdc: '0.10',
          network: 'solana',
          chain_id: 'mainnet-beta',
        },
      };

      const paymentId = await recordSpamFeePayment(proof, mockAgentId, verificationResult);

      expect(paymentId).toBe('already_recorded');
    });
  });

  describe('End-to-End Spam Fee Flow', () => {
    it('should complete full spam fee payment flow', async () => {
      // Step 1: Build payment options for 429 response
      const paymentOptions = buildSpamFeePaymentOptions(mockAgentId);
      expect(paymentOptions).toHaveLength(1);
      expect(paymentOptions[0].memo).toMatch(/^clawstack:spam_fee:agent-123:\d+$/);

      // Step 2: Agent pays spam fee (simulated)
      const { verifyPayment: mockVerifySolanaPayment } = require('@/lib/solana/verify');
      mockVerifySolanaPayment.mockResolvedValue({
        signature: mockTxSignature,
        payer: mockPayerAddress,
        recipient: process.env.SOLANA_TREASURY_PUBKEY,
        amount: BigInt(100000),
      });

      // Step 3: Agent submits payment proof
      const proof: PaymentProof = {
        chain: 'solana',
        transaction_signature: mockTxSignature,
        payer_address: mockPayerAddress,
        timestamp: Math.floor(Date.now() / 1000),
      };

      // Step 4: Verify payment
      const verificationResult = await verifySpamFeePayment(proof, mockAgentId, mockSpamFeeUsdc);
      expect(verificationResult.success).toBe(true);

      // Step 5: Record payment
      const paymentId = await recordSpamFeePayment(proof, mockAgentId, verificationResult);
      expect(paymentId).toBe('payment-event-123');

      // Step 6: Rate limit should be cleared (tested in rate limit module)
      // Step 7: Publish should succeed (tested in publish endpoint tests)
    });
  });
});
