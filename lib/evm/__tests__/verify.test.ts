/**
 * EVM Payment Verification Tests
 *
 * Tests for Base L2 USDC payment verification.
 * Mirrors the Solana verification test structure.
 *
 * @see lib/evm/verify.ts
 * @see claude/operations/tasks.md Task 3.2.10
 */

import { type TransactionReceipt } from 'viem';
import {
  EVMPaymentVerificationError,
  parseErc20Transfers,
  findUsdcTransfer,
  parseReference,
  validateReference,
  validateTransactionSuccess,
  usdcToRaw,
  rawToUsdc,
  isValidTransactionHash,
  REQUIRED_CONFIRMATIONS,
  type Erc20Transfer,
} from '../verify';
import { USDC_CONTRACT_BASE } from '../usdc-abi';

// ============================================
// Test Fixtures
// ============================================

const MOCK_TREASURY_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D';
const MOCK_PAYER_ADDRESS = '0x1234567890123456789012345678901234567890';
const MOCK_TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

// Mock Transfer event log
function createMockTransferLog(
  from: string,
  to: string,
  value: bigint,
  contractAddress: string = USDC_CONTRACT_BASE
) {
  // Transfer event topic: keccak256("Transfer(address,address,uint256)")
  const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  // Encode addresses as topics (padded to 32 bytes)
  const fromTopic = `0x000000000000000000000000${from.slice(2).toLowerCase()}`;
  const toTopic = `0x000000000000000000000000${to.slice(2).toLowerCase()}`;

  // Encode value as data (padded to 32 bytes)
  const valueHex = value.toString(16).padStart(64, '0');

  return {
    address: contractAddress as `0x${string}`,
    topics: [
      transferTopic as `0x${string}`,
      fromTopic as `0x${string}`,
      toTopic as `0x${string}`,
    ],
    data: `0x${valueHex}` as `0x${string}`,
    blockNumber: BigInt(1000000),
    transactionHash: MOCK_TX_HASH as `0x${string}`,
    transactionIndex: 0,
    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    logIndex: 0,
    removed: false,
  };
}

function createMockReceipt(
  logs: ReturnType<typeof createMockTransferLog>[],
  status: 'success' | 'reverted' = 'success'
): TransactionReceipt {
  return {
    transactionHash: MOCK_TX_HASH as `0x${string}`,
    transactionIndex: 0,
    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    blockNumber: BigInt(1000000),
    from: MOCK_PAYER_ADDRESS as `0x${string}`,
    to: USDC_CONTRACT_BASE as `0x${string}`,
    cumulativeGasUsed: BigInt(21000),
    gasUsed: BigInt(21000),
    contractAddress: null,
    logs: logs as TransactionReceipt['logs'],
    logsBloom: '0x' as `0x${string}`,
    status,
    effectiveGasPrice: BigInt(1000000000),
    type: 'eip1559',
    root: undefined,
    blobGasUsed: undefined,
    blobGasPrice: undefined,
  };
}

// ============================================
// Setup/Teardown
// ============================================

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    BASE_TREASURY_ADDRESS: MOCK_TREASURY_ADDRESS,
    USDC_CONTRACT_BASE: USDC_CONTRACT_BASE,
  };
});

afterEach(() => {
  process.env = originalEnv;
});

// ============================================
// parseErc20Transfers Tests
// ============================================

describe('parseErc20Transfers', () => {
  it('should parse a valid USDC transfer event', () => {
    const log = createMockTransferLog(
      MOCK_PAYER_ADDRESS,
      MOCK_TREASURY_ADDRESS,
      BigInt(250000) // 0.25 USDC
    );
    const receipt = createMockReceipt([log]);

    const transfers = parseErc20Transfers(receipt);

    expect(transfers).toHaveLength(1);
    expect(transfers[0].from.toLowerCase()).toBe(MOCK_PAYER_ADDRESS.toLowerCase());
    expect(transfers[0].to.toLowerCase()).toBe(MOCK_TREASURY_ADDRESS.toLowerCase());
    expect(transfers[0].value).toBe(BigInt(250000));
  });

  it('should filter by token contract when specified', () => {
    const usdcLog = createMockTransferLog(
      MOCK_PAYER_ADDRESS,
      MOCK_TREASURY_ADDRESS,
      BigInt(250000),
      USDC_CONTRACT_BASE
    );
    const otherLog = createMockTransferLog(
      MOCK_PAYER_ADDRESS,
      MOCK_TREASURY_ADDRESS,
      BigInt(1000000),
      '0x0000000000000000000000000000000000000001' // Different token
    );
    const receipt = createMockReceipt([usdcLog, otherLog]);

    const transfers = parseErc20Transfers(receipt, USDC_CONTRACT_BASE as `0x${string}`);

    expect(transfers).toHaveLength(1);
    expect(transfers[0].contractAddress.toLowerCase()).toBe(USDC_CONTRACT_BASE.toLowerCase());
  });

  it('should return empty array for receipt with no transfer events', () => {
    const receipt = createMockReceipt([]);

    const transfers = parseErc20Transfers(receipt);

    expect(transfers).toHaveLength(0);
  });

  it('should handle multiple transfers in one transaction', () => {
    const log1 = createMockTransferLog(
      MOCK_PAYER_ADDRESS,
      MOCK_TREASURY_ADDRESS,
      BigInt(100000)
    );
    const log2 = createMockTransferLog(
      MOCK_PAYER_ADDRESS,
      '0x9999999999999999999999999999999999999999',
      BigInt(50000)
    );
    const receipt = createMockReceipt([log1, log2]);

    const transfers = parseErc20Transfers(receipt);

    expect(transfers).toHaveLength(2);
  });
});

// ============================================
// findUsdcTransfer Tests
// ============================================

describe('findUsdcTransfer', () => {
  it('should find USDC transfer from list', () => {
    const transfers: Erc20Transfer[] = [
      {
        from: MOCK_PAYER_ADDRESS as `0x${string}`,
        to: MOCK_TREASURY_ADDRESS as `0x${string}`,
        value: BigInt(250000),
        contractAddress: USDC_CONTRACT_BASE as `0x${string}`,
      },
    ];

    const result = findUsdcTransfer(transfers);

    expect(result.contractAddress.toLowerCase()).toBe(USDC_CONTRACT_BASE.toLowerCase());
  });

  it('should throw if no USDC transfer found', () => {
    const transfers: Erc20Transfer[] = [
      {
        from: MOCK_PAYER_ADDRESS as `0x${string}`,
        to: MOCK_TREASURY_ADDRESS as `0x${string}`,
        value: BigInt(250000),
        contractAddress: '0x0000000000000000000000000000000000000001' as `0x${string}`,
      },
    ];

    expect(() => findUsdcTransfer(transfers)).toThrow(EVMPaymentVerificationError);
    expect(() => findUsdcTransfer(transfers)).toThrow('No USDC transfer found');
  });

  it('should throw if transfer list is empty', () => {
    expect(() => findUsdcTransfer([])).toThrow(EVMPaymentVerificationError);
  });
});


// ============================================
// parseReference Tests
// ============================================

describe('parseReference', () => {
  it('should parse valid reference format', () => {
    const reference = '0xclawstack_post123_1706960000';

    const result = parseReference(reference);

    expect(result).not.toBeNull();
    expect(result?.prefix).toBe('0xclawstack');
    expect(result?.postId).toBe('post123');
    expect(result?.timestamp).toBe(1706960000);
  });

  it('should return null for null input', () => {
    expect(parseReference(null)).toBeNull();
  });

  it('should return null for invalid format', () => {
    expect(parseReference('invalid')).toBeNull();
    expect(parseReference('clawstack_post123_1706960000')).toBeNull(); // Missing 0x prefix
    expect(parseReference('0xclawstack_post123')).toBeNull(); // Missing timestamp
  });

  it('should handle UUIDs in post ID', () => {
    const reference = '0xclawstack_550e8400-e29b-41d4-a716-446655440000_1706960000';

    const result = parseReference(reference);

    expect(result?.postId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

// ============================================
// validateReference Tests
// ============================================

describe('validateReference', () => {
  it('should pass for matching reference', () => {
    const reference = {
      prefix: '0xclawstack',
      postId: 'post123',
      timestamp: 1706960000,
    };

    expect(() => validateReference(reference, 'post123')).not.toThrow();
  });

  it('should pass for null reference (timing-based validation)', () => {
    expect(() => validateReference(null, 'post123')).not.toThrow();
  });

  it('should throw for mismatched post ID', () => {
    const reference = {
      prefix: '0xclawstack',
      postId: 'post123',
      timestamp: 1706960000,
    };

    expect(() => validateReference(reference, 'different_post')).toThrow(EVMPaymentVerificationError);
    expect(() => validateReference(reference, 'different_post')).toThrow('post ID mismatch');
  });

  it('should throw for expired reference', () => {
    const reference = {
      prefix: '0xclawstack',
      postId: 'post123',
      timestamp: 1706960000,
    };

    // Request timestamp 10 minutes later
    const requestTimestamp = 1706960000 + 600;

    expect(() => validateReference(reference, 'post123', requestTimestamp, 300)).toThrow(
      EVMPaymentVerificationError
    );
    expect(() => validateReference(reference, 'post123', requestTimestamp, 300)).toThrow('expired');
  });

  it('should pass for reference within expiration window', () => {
    const reference = {
      prefix: '0xclawstack',
      postId: 'post123',
      timestamp: 1706960000,
    };

    // Request timestamp 2 minutes later (within 5 min window)
    const requestTimestamp = 1706960000 + 120;

    expect(() => validateReference(reference, 'post123', requestTimestamp, 300)).not.toThrow();
  });
});

// ============================================
// validateTransactionSuccess Tests
// ============================================

describe('validateTransactionSuccess', () => {
  it('should pass for successful transaction', () => {
    const receipt = createMockReceipt([], 'success');

    expect(() => validateTransactionSuccess(receipt)).not.toThrow();
  });

  it('should throw for reverted transaction', () => {
    const receipt = createMockReceipt([], 'reverted');

    expect(() => validateTransactionSuccess(receipt)).toThrow(EVMPaymentVerificationError);
    expect(() => validateTransactionSuccess(receipt)).toThrow('reverted');
  });
});

// ============================================
// Utility Function Tests
// ============================================

describe('usdcToRaw', () => {
  it('should convert USDC to raw units', () => {
    expect(usdcToRaw(0.25)).toBe(BigInt(250000));
    expect(usdcToRaw(1.0)).toBe(BigInt(1000000));
    expect(usdcToRaw(0.05)).toBe(BigInt(50000));
    expect(usdcToRaw(0.99)).toBe(BigInt(990000));
  });
});

describe('rawToUsdc', () => {
  it('should convert raw units to USDC string', () => {
    expect(rawToUsdc(BigInt(250000))).toBe('0.25');
    expect(rawToUsdc(BigInt(1000000))).toBe('1.00');
    expect(rawToUsdc(BigInt(50000))).toBe('0.05');
    expect(rawToUsdc(BigInt(990000))).toBe('0.99');
  });
});

describe('isValidTransactionHash', () => {
  it('should return true for valid transaction hash', () => {
    expect(isValidTransactionHash(MOCK_TX_HASH)).toBe(true);
    expect(isValidTransactionHash('0x' + 'a'.repeat(64))).toBe(true);
    expect(isValidTransactionHash('0x' + 'A'.repeat(64))).toBe(true);
  });

  it('should return false for invalid transaction hash', () => {
    expect(isValidTransactionHash('invalid')).toBe(false);
    expect(isValidTransactionHash('0x123')).toBe(false); // Too short
    expect(isValidTransactionHash('0x' + 'g'.repeat(64))).toBe(false); // Invalid hex
    expect(isValidTransactionHash('0x' + 'a'.repeat(65))).toBe(false); // Too long
  });
});

// ============================================
// Constants Tests
// ============================================

describe('REQUIRED_CONFIRMATIONS', () => {
  it('should be 12 for Base L2', () => {
    expect(REQUIRED_CONFIRMATIONS).toBe(12);
  });
});
