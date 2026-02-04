/**
 * Cross-Chain Payment Verification Tests
 *
 * Tests the unified payment verification system across both Solana and Base chains.
 * Ensures double-spend prevention works across chains and that verification
 * responses are standardized.
 *
 * @see claude/operations/tasks.md Task 3.5.7
 */

import { verifyPayment, type PaymentProof, type PostForPayment } from '@/lib/x402';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import * as solanaVerify from '@/lib/solana/verify';
import * as evmVerify from '@/lib/evm/verify';

// Mock the chain-specific verifiers
jest.mock('@/lib/solana/verify');
jest.mock('@/lib/evm/verify');
jest.mock('@/lib/db/supabase-server');

const mockSolanaVerify = solanaVerify as jest.Mocked<typeof solanaVerify>;
const mockEvmVerify = evmVerify as jest.Mocked<typeof evmVerify>;
const mockSupabase = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>;

describe('Cross-Chain Payment Verification', () => {
  const mockPost: PostForPayment = {
    id: 'post_123',
    title: 'Test Post',
    content: 'Test content',
    summary: 'Test summary',
    is_paid: true,
    price_usdc: 0.25,
    paid_view_count: 0,
    author_id: 'agent_456',
    author: {
      id: 'agent_456',
      display_name: 'Test Agent',
      avatar_url: null,
      wallet_solana: 'SolWallet111111111111111111111111111111111',
      wallet_base: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase to return no existing payment by default
    mockSupabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Set up environment variables
    process.env.SOLANA_TREASURY_PUBKEY = 'TreasuryWallet1111111111111111111111111111';
    process.env.BASE_TREASURY_ADDRESS = '0x1234567890123456789012345678901234567890';
    process.env.PLATFORM_FEE_BPS = '500';
  });

  describe('Solana Payment Verification', () => {
    it('should verify valid Solana payment for post', async () => {
      const proof: PaymentProof = {
        chain: 'solana',
        transaction_signature: '5xK3vTest123456789',
        payer_address: '7sK9xPayer111111111111111111111111111111',
        timestamp: Math.floor(Date.now() / 1000),
      };

      // Mock successful Solana verification
      mockSolanaVerify.verifyPayment.mockResolvedValue({
        signature: proof.transaction_signature,
        payer: proof.payer_address,
        recipient: process.env.SOLANA_TREASURY_PUBKEY!,
        amount: BigInt(250000), // 0.25 USDC
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        memo: `clawstack:${mockPost.id}:${proof.timestamp}`,
        postId: mockPost.id,
        timestamp: proof.timestamp,
        confirmationStatus: 'confirmed' as const,
      });

      const result = await verifyPayment(proof, mockPost);

      expect(result.success).toBe(true);
      expect(result.payment).toBeDefined();
      expect(result.payment?.network).toBe('solana');
      expect(result.payment?.chain_id).toBe('mainnet-beta');
      expect(result.payment?.amount_usdc).toBe('0.25');
      expect(mockSolanaVerify.verifyPayment).toHaveBeenCalledWith({
        signature: proof.transaction_signature,
        expectedPostId: mockPost.id,
        expectedAmountRaw: BigInt(250000),
        requestTimestamp: proof.timestamp,
        memoExpirationSeconds: 300,
      });
    });

    it('should reject invalid Solana payment', async () => {
      const proof: PaymentProof = {
        chain: 'solana',
        transaction_signature: 'InvalidTx123',
        payer_address: '7sK9xPayer111111111111111111111111111111',
        timestamp: Math.floor(Date.now() / 1000),
      };

      // Mock failed Solana verification
      const error = new solanaVerify.PaymentVerificationError(
        'Transaction not found',
        'TX_NOT_FOUND'
      );
      mockSolanaVerify.verifyPayment.mockRejectedValue(error);

      const result = await verifyPayment(proof, mockPost);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Base (EVM) Payment Verification', () => {
    it('should verify valid Base payment for post', async () => {
      const proof: PaymentProof = {
        chain: 'base',
        transaction_signature: '0xabc123def456789012345678901234567890123456789012345678901234567890',
        payer_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D',
        timestamp: Math.floor(Date.now() / 1000),
      };

      // Mock successful Base verification
      mockEvmVerify.verifyEVMPayment.mockResolvedValue({
        transactionHash: proof.transaction_signature as `0x${string}`,
        payer: proof.payer_address as `0x${string}`,
        recipient: process.env.BASE_TREASURY_ADDRESS as `0x${string}`,
        amount: BigInt(250000), // 0.25 USDC
        contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
        blockNumber: BigInt(12345678),
        confirmations: 12,
        reference: `0xclawstack_${mockPost.id}_${proof.timestamp}`,
      });

      const result = await verifyPayment(proof, mockPost);

      expect(result.success).toBe(true);
      expect(result.payment).toBeDefined();
      expect(result.payment?.network).toBe('base');
      expect(result.payment?.chain_id).toBe('8453');
      expect(result.payment?.amount_usdc).toBe('0.25');
      expect(mockEvmVerify.verifyEVMPayment).toHaveBeenCalledWith({
        transactionHash: proof.transaction_signature,
        expectedPostId: mockPost.id,
        expectedAmountRaw: BigInt(250000),
        requestTimestamp: proof.timestamp,
        referenceExpirationSeconds: 300,
      });
    });

    it('should reject invalid Base payment', async () => {
      const proof: PaymentProof = {
        chain: 'base',
        transaction_signature: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payer_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D',
        timestamp: Math.floor(Date.now() / 1000),
      };

      // Mock failed Base verification
      const error = new evmVerify.EVMPaymentVerificationError(
        'Insufficient confirmations',
        'INSUFFICIENT_CONFIRMATIONS'
      );
      mockEvmVerify.verifyEVMPayment.mockRejectedValue(error);

      const result = await verifyPayment(proof, mockPost);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Double-Spend Prevention', () => {
    it('should reject reused Solana transaction', async () => {
      const proof: PaymentProof = {
        chain: 'solana',
        transaction_signature: '5xK3vAlreadyUsed123',
        payer_address: '7sK9xPayer111111111111111111111111111111',
        timestamp: Math.floor(Date.now() / 1000),
      };

      // Mock existing payment record
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'payment_789',
            resource_type: 'post',
            resource_id: 'post_999',
          },
          error: null,
        }),
      });

      const result = await verifyPayment(proof, mockPost);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction already used for payment');
      expect(result.error_code).toBe('TRANSACTION_ALREADY_USED');
      expect(mockSolanaVerify.verifyPayment).not.toHaveBeenCalled();
    });

    it('should reject reused Base transaction', async () => {
      const proof: PaymentProof = {
        chain: 'base',
        transaction_signature: '0xabc123def456789012345678901234567890123456789012345678901234567890',
        payer_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D',
        timestamp: Math.floor(Date.now() / 1000),
      };

      // Mock existing payment record
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'payment_888',
            resource_type: 'post',
            resource_id: 'post_888',
          },
          error: null,
        }),
      });

      const result = await verifyPayment(proof, mockPost);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction already used for payment');
      expect(result.error_code).toBe('TRANSACTION_ALREADY_USED');
      expect(mockEvmVerify.verifyEVMPayment).not.toHaveBeenCalled();
    });

    it('should prevent same transaction from being used on different posts', async () => {
      const sharedTxSignature = '5xK3vShared123456789';
      const proof: PaymentProof = {
        chain: 'solana',
        transaction_signature: sharedTxSignature,
        payer_address: '7sK9xPayer111111111111111111111111111111',
        timestamp: Math.floor(Date.now() / 1000),
      };

      // Mock that transaction was already used for a different post
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'payment_777',
            resource_type: 'post',
            resource_id: 'different_post_id',
          },
          error: null,
        }),
      });

      const result = await verifyPayment(proof, mockPost);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction already used for payment');
      expect(result.error_code).toBe('TRANSACTION_ALREADY_USED');
    });
  });

  describe('Chain Validation', () => {
    it('should reject unsupported chain', async () => {
      const proof = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chain: 'ethereum' as any,
        transaction_signature: '0xabc123',
        payer_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const result = await verifyPayment(proof, mockPost);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported payment chain');
      expect(result.error_code).toBe('UNSUPPORTED_CHAIN');
    });
  });

  describe('Standardized Response Format', () => {
    it('should return consistent format for Solana success', async () => {
      const proof: PaymentProof = {
        chain: 'solana',
        transaction_signature: '5xK3vTest123',
        payer_address: '7sK9xPayer111111111111111111111111111111',
        timestamp: Math.floor(Date.now() / 1000),
      };

      mockSolanaVerify.verifyPayment.mockResolvedValue({
        signature: proof.transaction_signature,
        payer: proof.payer_address,
        recipient: process.env.SOLANA_TREASURY_PUBKEY!,
        amount: BigInt(250000),
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        memo: `clawstack:${mockPost.id}:${proof.timestamp}`,
        postId: mockPost.id,
        timestamp: proof.timestamp,
        confirmationStatus: 'confirmed' as const,
      });

      const result = await verifyPayment(proof, mockPost);

      expect(result).toMatchObject({
        success: true,
        payment: {
          signature: expect.any(String),
          payer: expect.any(String),
          recipient: expect.any(String),
          amount_raw: expect.any(BigInt),
          amount_usdc: expect.any(String),
          network: 'solana',
          chain_id: 'mainnet-beta',
        },
      });
    });

    it('should return consistent format for Base success', async () => {
      const proof: PaymentProof = {
        chain: 'base',
        transaction_signature: '0xabc123def456789012345678901234567890123456789012345678901234567890',
        payer_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D',
        timestamp: Math.floor(Date.now() / 1000),
      };

      mockEvmVerify.verifyEVMPayment.mockResolvedValue({
        transactionHash: proof.transaction_signature as `0x${string}`,
        payer: proof.payer_address as `0x${string}`,
        recipient: process.env.BASE_TREASURY_ADDRESS as `0x${string}`,
        amount: BigInt(250000),
        contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
        blockNumber: BigInt(12345678),
        confirmations: 12,
        reference: `0xclawstack_${mockPost.id}_${proof.timestamp}`,
      });

      const result = await verifyPayment(proof, mockPost);

      expect(result).toMatchObject({
        success: true,
        payment: {
          signature: expect.any(String),
          payer: expect.any(String),
          recipient: expect.any(String),
          amount_raw: expect.any(BigInt),
          amount_usdc: expect.any(String),
          network: 'base',
          chain_id: '8453',
        },
      });
    });

    it('should return consistent error format for both chains', async () => {
      const solanaProof: PaymentProof = {
        chain: 'solana',
        transaction_signature: '5xK3vFail123',
        payer_address: '7sK9xPayer111111111111111111111111111111',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const baseProof: PaymentProof = {
        chain: 'base',
        transaction_signature: '0xfail123def456789012345678901234567890123456789012345678901234567890',
        payer_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D',
        timestamp: Math.floor(Date.now() / 1000),
      };

      mockSolanaVerify.verifyPayment.mockRejectedValue(
        new solanaVerify.PaymentVerificationError('Error', 'TX_NOT_FOUND')
      );
      mockEvmVerify.verifyEVMPayment.mockRejectedValue(
        new evmVerify.EVMPaymentVerificationError('Error', 'TX_NOT_FOUND')
      );

      const solanaResult = await verifyPayment(solanaProof, mockPost);
      const baseResult = await verifyPayment(baseProof, mockPost);

      // Both should have same structure
      expect(solanaResult).toMatchObject({
        success: false,
        error: expect.any(String),
      });
      expect(baseResult).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe('Amount Validation', () => {
    it('should verify correct amount for different price points on Solana', async () => {
      const testPrices = [0.05, 0.25, 0.50, 0.99];

      for (const price of testPrices) {
        const testPost = { ...mockPost, price_usdc: price };
        const proof: PaymentProof = {
          chain: 'solana',
          transaction_signature: `5xK3v${price}Test`,
          payer_address: '7sK9xPayer111111111111111111111111111111',
          timestamp: Math.floor(Date.now() / 1000),
        };

        mockSolanaVerify.verifyPayment.mockResolvedValue({
          signature: proof.transaction_signature,
          payer: proof.payer_address,
          recipient: process.env.SOLANA_TREASURY_PUBKEY!,
          amount: BigInt(price * 1_000_000),
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          memo: `clawstack:${testPost.id}:${proof.timestamp}`,
          postId: testPost.id,
          timestamp: proof.timestamp,
          confirmationStatus: 'confirmed' as const,
        });

        const result = await verifyPayment(proof, testPost);

        expect(result.success).toBe(true);
        expect(result.payment?.amount_usdc).toBe(price.toFixed(2));
      }
    });

    it('should verify correct amount for different price points on Base', async () => {
      const testPrices = [0.05, 0.25, 0.50, 0.99];

      for (const price of testPrices) {
        const testPost = { ...mockPost, price_usdc: price };
        const proof: PaymentProof = {
          chain: 'base',
          transaction_signature: `0x${price.toString().replace('.', '')}abc123def456789012345678901234567890123456789012345678901234`,
          payer_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D',
          timestamp: Math.floor(Date.now() / 1000),
        };

        mockEvmVerify.verifyEVMPayment.mockResolvedValue({
          transactionHash: proof.transaction_signature as `0x${string}`,
          payer: proof.payer_address as `0x${string}`,
          recipient: process.env.BASE_TREASURY_ADDRESS as `0x${string}`,
          amount: BigInt(price * 1_000_000),
          contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
          blockNumber: BigInt(12345678),
          confirmations: 12,
          reference: `0xclawstack_${testPost.id}_${proof.timestamp}`,
        });

        const result = await verifyPayment(proof, testPost);

        expect(result.success).toBe(true);
        expect(result.payment?.amount_usdc).toBe(price.toFixed(2));
      }
    });
  });
});
