/**
 * Solana Payment Verification Tests
 *
 * Tests for lib/solana/verify.ts
 *
 * @see lib/solana/verify.ts
 * @see claude/operations/tasks.md Task 2.2.10
 */

import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  PaymentVerificationError,
  fetchTransaction,
  parseTokenTransfers,
  parseMemo,
  parseMemoFormat,
  validateMemo,
  checkTransactionFinality,
  validateTransactionSuccess,
  verifyPayment,
  type TokenTransfer,
} from '../verify';
import * as clientModule from '../client';

// Mock the client module
jest.mock('../client', () => ({
  getTransactionWithFallback: jest.fn(),
  getSolanaConnection: jest.fn(),
}));

// Test constants
const MOCK_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MOCK_TREASURY_PUBKEY = 'CStkPay111111111111111111111111111111111111';
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// Set up environment variables for tests
beforeAll(() => {
  process.env.USDC_MINT_SOLANA = MOCK_USDC_MINT;
  process.env.SOLANA_TREASURY_PUBKEY = MOCK_TREASURY_PUBKEY;
});

// Helper to create mock parsed transaction
function createMockTransaction(options: {
  error?: object | null;
  transfers?: Array<{
    source: string;
    destination: string;
    amount: string;
    mint: string;
    type?: 'transfer' | 'transferChecked';
  }>;
  memo?: string | null;
  innerTransfers?: Array<{
    source: string;
    destination: string;
    amount: string;
    mint: string;
  }>;
}) {
  const instructions: Array<{
    programId: PublicKey;
    parsed?: { type: string; info: Record<string, unknown> };
    data?: string;
  }> = [];

  // Add token transfer instructions
  for (const transfer of options.transfers || []) {
    instructions.push({
      programId: TOKEN_PROGRAM_ID,
      parsed: {
        type: transfer.type || 'transferChecked',
        info: {
          source: transfer.source,
          destination: transfer.destination,
          amount: transfer.amount,
          mint: transfer.mint,
        },
      },
    });
  }

  // Add memo instruction if provided
  if (options.memo !== undefined && options.memo !== null) {
    instructions.push({
      programId: MEMO_PROGRAM_ID,
      parsed: options.memo as unknown as { type: string; info: Record<string, unknown> },
    });
  }

  // Create inner instructions for composed transactions
  const innerInstructions = [];
  if (options.innerTransfers) {
    innerInstructions.push({
      index: 0,
      instructions: options.innerTransfers.map((transfer) => ({
        programId: TOKEN_PROGRAM_ID,
        parsed: {
          type: 'transferChecked',
          info: {
            source: transfer.source,
            destination: transfer.destination,
            amount: transfer.amount,
            mint: transfer.mint,
          },
        },
      })),
    });
  }

  return {
    transaction: {
      message: {
        instructions,
      },
    },
    meta: {
      err: options.error || null,
      innerInstructions,
    },
  };
}

describe('Solana Payment Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // 2.2.1: fetchTransaction Tests
  // ============================================
  describe('fetchTransaction', () => {
    it('returns transaction when found', async () => {
      const mockTx = createMockTransaction({});
      (clientModule.getTransactionWithFallback as jest.Mock).mockResolvedValue(mockTx);

      const result = await fetchTransaction('test-signature');

      expect(result).toBe(mockTx);
      expect(clientModule.getTransactionWithFallback).toHaveBeenCalledWith('test-signature');
    });

    it('throws TX_NOT_FOUND when transaction is null', async () => {
      (clientModule.getTransactionWithFallback as jest.Mock).mockResolvedValue(null);

      await expect(fetchTransaction('test-signature')).rejects.toThrow(PaymentVerificationError);
      await expect(fetchTransaction('test-signature')).rejects.toMatchObject({
        code: 'TX_NOT_FOUND',
      });
    });

    it('throws TX_FAILED when transaction has error', async () => {
      const mockTx = createMockTransaction({ error: { InstructionError: [0, 'Custom'] } });
      (clientModule.getTransactionWithFallback as jest.Mock).mockResolvedValue(mockTx);

      await expect(fetchTransaction('test-signature')).rejects.toThrow(PaymentVerificationError);
      await expect(fetchTransaction('test-signature')).rejects.toMatchObject({
        code: 'TX_FAILED',
      });
    });
  });

  // ============================================
  // 2.2.2: parseTokenTransfers Tests
  // ============================================
  describe('parseTokenTransfers', () => {
    it('parses single transfer from transaction', () => {
      const mockTx = createMockTransaction({
        transfers: [
          {
            source: 'source-account',
            destination: 'dest-account',
            amount: '1000000',
            mint: MOCK_USDC_MINT,
          },
        ],
      });

      const transfers = parseTokenTransfers(mockTx as never);

      expect(transfers).toHaveLength(1);
      expect(transfers[0]).toEqual({
        source: 'source-account',
        destination: 'dest-account',
        amount: BigInt(1000000),
        mint: MOCK_USDC_MINT,
      });
    });

    it('parses multiple transfers', () => {
      const mockTx = createMockTransaction({
        transfers: [
          { source: 'src1', destination: 'dst1', amount: '100', mint: 'mint1' },
          { source: 'src2', destination: 'dst2', amount: '200', mint: 'mint2' },
        ],
      });

      const transfers = parseTokenTransfers(mockTx as never);

      expect(transfers).toHaveLength(2);
    });

    it('parses transfers from inner instructions', () => {
      const mockTx = createMockTransaction({
        transfers: [],
        innerTransfers: [
          {
            source: 'inner-source',
            destination: 'inner-dest',
            amount: '500000',
            mint: MOCK_USDC_MINT,
          },
        ],
      });

      const transfers = parseTokenTransfers(mockTx as never);

      expect(transfers).toHaveLength(1);
      expect(transfers[0].source).toBe('inner-source');
    });

    it('returns empty array when no transfers', () => {
      const mockTx = createMockTransaction({ transfers: [] });

      const transfers = parseTokenTransfers(mockTx as never);

      expect(transfers).toHaveLength(0);
    });
  });





  // ============================================
  // 2.2.6 & 2.2.7: parseMemo Tests (Invalid memo → error)
  // ============================================
  describe('parseMemo', () => {
    it('extracts memo from transaction', () => {
      const mockTx = createMockTransaction({
        transfers: [],
        memo: 'clawstack:post_123:1706960000',
      });

      const memo = parseMemo(mockTx as never);

      expect(memo).toBe('clawstack:post_123:1706960000');
    });

    it('returns null when no memo instruction', () => {
      const mockTx = createMockTransaction({ transfers: [] });

      const memo = parseMemo(mockTx as never);

      expect(memo).toBeNull();
    });
  });

  describe('parseMemoFormat', () => {
    it('parses valid memo format', () => {
      const result = parseMemoFormat('clawstack:post_abc123:1706960000');

      expect(result).toEqual({
        prefix: 'clawstack',
        postId: 'post_abc123',
        timestamp: 1706960000,
      });
    });

    it('throws INVALID_MEMO for null memo', () => {
      expect(() => parseMemoFormat(null)).toThrow(PaymentVerificationError);
      expect(() => parseMemoFormat(null)).toThrow('Missing payment memo');
    });

    it('throws INVALID_MEMO for wrong number of parts', () => {
      expect(() => parseMemoFormat('clawstack:post_123')).toThrow(PaymentVerificationError);
      expect(() => parseMemoFormat('clawstack:post_123:ts:extra')).toThrow(PaymentVerificationError);
    });

    it('throws INVALID_MEMO for wrong prefix', () => {
      expect(() => parseMemoFormat('wrongprefix:post_123:1706960000')).toThrow(
        PaymentVerificationError
      );
      expect(() => parseMemoFormat('wrongprefix:post_123:1706960000')).toThrow(
        "Invalid memo prefix"
      );
    });

    it('throws INVALID_MEMO for non-numeric timestamp', () => {
      expect(() => parseMemoFormat('clawstack:post_123:invalid')).toThrow(PaymentVerificationError);
    });
  });

  describe('validateMemo', () => {
    it('passes when post ID matches', () => {
      const memo = { prefix: 'clawstack', postId: 'post_123', timestamp: 1706960000 };

      expect(() => validateMemo(memo, 'post_123')).not.toThrow();
    });

    it('throws INVALID_MEMO when post ID does not match', () => {
      const memo = { prefix: 'clawstack', postId: 'post_123', timestamp: 1706960000 };

      expect(() => validateMemo(memo, 'post_456')).toThrow(PaymentVerificationError);
      expect(() => validateMemo(memo, 'post_456')).toThrow('Memo post ID mismatch');
    });

    it('throws MEMO_EXPIRED when timestamp exceeds limit', () => {
      const memo = { prefix: 'clawstack', postId: 'post_123', timestamp: 1706960000 };
      const requestTimestamp = 1706960600; // 10 minutes later

      expect(() => validateMemo(memo, 'post_123', requestTimestamp, 300)).toThrow(
        PaymentVerificationError
      );
      expect(() => validateMemo(memo, 'post_123', requestTimestamp, 300)).toThrow('expired');
    });

    it('passes when timestamp is within limit', () => {
      const memo = { prefix: 'clawstack', postId: 'post_123', timestamp: 1706960000 };
      const requestTimestamp = 1706960100; // 100 seconds later

      expect(() => validateMemo(memo, 'post_123', requestTimestamp, 300)).not.toThrow();
    });
  });

  // ============================================
  // 2.2.8: checkTransactionFinality Tests (Unconfirmed tx → error)
  // ============================================
  describe('checkTransactionFinality', () => {
    it('returns confirmed when transaction is confirmed', async () => {
      const mockConnection = {
        getSignatureStatus: jest.fn().mockResolvedValue({
          value: { confirmationStatus: 'confirmed' },
        }),
      };
      (clientModule.getSolanaConnection as jest.Mock).mockReturnValue(mockConnection);

      const result = await checkTransactionFinality('test-sig');

      expect(result).toBe('confirmed');
    });

    it('returns finalized when transaction is finalized', async () => {
      const mockConnection = {
        getSignatureStatus: jest.fn().mockResolvedValue({
          value: { confirmationStatus: 'finalized' },
        }),
      };
      (clientModule.getSolanaConnection as jest.Mock).mockReturnValue(mockConnection);

      const result = await checkTransactionFinality('test-sig');

      expect(result).toBe('finalized');
    });

    it('throws STATUS_UNKNOWN when status value is null', async () => {
      const mockConnection = {
        getSignatureStatus: jest.fn().mockResolvedValue({ value: null }),
      };
      (clientModule.getSolanaConnection as jest.Mock).mockReturnValue(mockConnection);

      await expect(checkTransactionFinality('test-sig')).rejects.toThrow(PaymentVerificationError);
      await expect(checkTransactionFinality('test-sig')).rejects.toMatchObject({
        code: 'STATUS_UNKNOWN',
      });
    });

    it('throws NOT_CONFIRMED when transaction is only processed', async () => {
      const mockConnection = {
        getSignatureStatus: jest.fn().mockResolvedValue({
          value: { confirmationStatus: 'processed' },
        }),
      };
      (clientModule.getSolanaConnection as jest.Mock).mockReturnValue(mockConnection);

      await expect(checkTransactionFinality('test-sig')).rejects.toThrow(PaymentVerificationError);
      await expect(checkTransactionFinality('test-sig')).rejects.toMatchObject({
        code: 'NOT_CONFIRMED',
      });
    });
  });

  // ============================================
  // 2.2.9: validateTransactionSuccess Tests
  // ============================================
  describe('validateTransactionSuccess', () => {
    it('passes when transaction has no error', () => {
      const mockTx = createMockTransaction({});

      expect(() => validateTransactionSuccess(mockTx as never)).not.toThrow();
    });

    it('throws TX_FAILED when transaction has error', () => {
      const mockTx = createMockTransaction({ error: { InstructionError: [0, 'Custom'] } });

      expect(() => validateTransactionSuccess(mockTx as never)).toThrow(PaymentVerificationError);
      expect(() => validateTransactionSuccess(mockTx as never)).toThrow('Transaction failed');
    });
  });

  // ============================================
  // Integration: verifyPayment (Valid payment → success)
  // ============================================
  describe('verifyPayment (integration)', () => {
    const validSignature = 'valid-test-signature';
    const validPostId = 'post_abc123';
    const validAmount = BigInt(250000); // 0.25 USDC
    const validTimestamp = 1706960000;

    it('returns verified payment for valid transaction', async () => {
      const mockTx = createMockTransaction({
        transfers: [
          {
            source: 'payer-account',
            destination: MOCK_TREASURY_PUBKEY,
            amount: '250000',
            mint: MOCK_USDC_MINT,
          },
        ],
        memo: `clawstack:${validPostId}:${validTimestamp}`,
      });

      (clientModule.getTransactionWithFallback as jest.Mock).mockResolvedValue(mockTx);

      const mockConnection = {
        getSignatureStatus: jest.fn().mockResolvedValue({
          value: { confirmationStatus: 'confirmed' },
        }),
      };
      (clientModule.getSolanaConnection as jest.Mock).mockReturnValue(mockConnection);

      const result = await verifyPayment({
        signature: validSignature,
        expectedPostId: validPostId,
        expectedAmountRaw: validAmount,
        requestTimestamp: validTimestamp,
      });

      expect(result).toEqual({
        signature: validSignature,
        payer: 'payer-account',
        recipient: MOCK_TREASURY_PUBKEY,
        amount: BigInt(250000),
        mint: MOCK_USDC_MINT,
        memo: `clawstack:${validPostId}:${validTimestamp}`,
        postId: validPostId,
        timestamp: validTimestamp,
        confirmationStatus: 'confirmed',
      });
    });

    it('rejects transaction with wrong mint', async () => {
      const mockTx = createMockTransaction({
        transfers: [
          {
            source: 'payer-account',
            destination: MOCK_TREASURY_PUBKEY,
            amount: '250000',
            mint: 'wrong-mint-address',
          },
        ],
        memo: `clawstack:${validPostId}:${validTimestamp}`,
      });

      (clientModule.getTransactionWithFallback as jest.Mock).mockResolvedValue(mockTx);

      await expect(
        verifyPayment({
          signature: validSignature,
          expectedPostId: validPostId,
          expectedAmountRaw: validAmount,
        })
      ).rejects.toMatchObject({ code: 'NO_USDC_TRANSFER' });
    });

    it('rejects transaction with wrong recipient', async () => {
      const mockTx = createMockTransaction({
        transfers: [
          {
            source: 'payer-account',
            destination: 'wrong-recipient',
            amount: '250000',
            mint: MOCK_USDC_MINT,
          },
        ],
        memo: `clawstack:${validPostId}:${validTimestamp}`,
      });

      (clientModule.getTransactionWithFallback as jest.Mock).mockResolvedValue(mockTx);

      await expect(
        verifyPayment({
          signature: validSignature,
          expectedPostId: validPostId,
          expectedAmountRaw: validAmount,
        })
      ).rejects.toMatchObject({ code: 'WRONG_RECIPIENT' });
    });

    it('rejects transaction with insufficient amount', async () => {
      const mockTx = createMockTransaction({
        transfers: [
          {
            source: 'payer-account',
            destination: MOCK_TREASURY_PUBKEY,
            amount: '100000', // 0.1 USDC (less than 0.25 required)
            mint: MOCK_USDC_MINT,
          },
        ],
        memo: `clawstack:${validPostId}:${validTimestamp}`,
      });

      (clientModule.getTransactionWithFallback as jest.Mock).mockResolvedValue(mockTx);

      await expect(
        verifyPayment({
          signature: validSignature,
          expectedPostId: validPostId,
          expectedAmountRaw: validAmount,
        })
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_AMOUNT' });
    });

    it('rejects transaction with invalid memo', async () => {
      const mockTx = createMockTransaction({
        transfers: [
          {
            source: 'payer-account',
            destination: MOCK_TREASURY_PUBKEY,
            amount: '250000',
            mint: MOCK_USDC_MINT,
          },
        ],
        memo: 'invalid-memo-format',
      });

      (clientModule.getTransactionWithFallback as jest.Mock).mockResolvedValue(mockTx);

      await expect(
        verifyPayment({
          signature: validSignature,
          expectedPostId: validPostId,
          expectedAmountRaw: validAmount,
        })
      ).rejects.toMatchObject({ code: 'INVALID_MEMO' });
    });

    it('rejects transaction with wrong post ID in memo', async () => {
      const mockTx = createMockTransaction({
        transfers: [
          {
            source: 'payer-account',
            destination: MOCK_TREASURY_PUBKEY,
            amount: '250000',
            mint: MOCK_USDC_MINT,
          },
        ],
        memo: `clawstack:wrong_post_id:${validTimestamp}`,
      });

      (clientModule.getTransactionWithFallback as jest.Mock).mockResolvedValue(mockTx);

      await expect(
        verifyPayment({
          signature: validSignature,
          expectedPostId: validPostId,
          expectedAmountRaw: validAmount,
        })
      ).rejects.toMatchObject({ code: 'INVALID_MEMO' });
    });
  });
});
