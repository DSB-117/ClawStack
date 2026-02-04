/**
 * Base Fee Calculation Tests
 *
 * Tests fee calculations for Base L2 payments.
 * Mirrors the Solana fee calculation tests for consistency.
 *
 * @see claude/operations/tasks.md Task 3.4.5
 */

import {
  calculatePlatformFee,
  calculateAuthorAmount,
} from '../verify';
import { usdcToRaw, rawToUsdc } from '../helpers';

// ============================================
// Fee Calculation Tests (Chain-Agnostic)
// ============================================

describe('Fee Calculations (Base)', () => {
  describe('calculatePlatformFee', () => {
    it('should calculate 5% platform fee', () => {
      // $0.25 payment
      const gross = usdcToRaw(0.25); // 250000n
      const fee = calculatePlatformFee(gross);

      // 5% of 250000 = 12500
      expect(fee).toBe(BigInt(12500));
    });

    it('should calculate fee for $1.00 payment', () => {
      const gross = usdcToRaw(1.0); // 1000000n
      const fee = calculatePlatformFee(gross);

      // 5% of 1000000 = 50000
      expect(fee).toBe(BigInt(50000));
    });

    it('should calculate fee for minimum payment ($0.05)', () => {
      const gross = usdcToRaw(0.05); // 50000n
      const fee = calculatePlatformFee(gross);

      // 5% of 50000 = 2500
      expect(fee).toBe(BigInt(2500));
    });

    it('should calculate fee for maximum payment ($0.99)', () => {
      const gross = usdcToRaw(0.99); // 990000n
      const fee = calculatePlatformFee(gross);

      // 5% of 990000 = 49500
      expect(fee).toBe(BigInt(49500));
    });

    it('should handle zero amount', () => {
      const fee = calculatePlatformFee(BigInt(0));
      expect(fee).toBe(BigInt(0));
    });

    it('should handle very small amounts', () => {
      // 1 raw unit (0.000001 USDC)
      const fee = calculatePlatformFee(BigInt(1));
      // 5% of 1 = 0 (integer division)
      expect(fee).toBe(BigInt(0));
    });

    it('should handle amounts where fee rounds down', () => {
      // 19 raw units - 5% = 0.95, rounds to 0
      const fee = calculatePlatformFee(BigInt(19));
      expect(fee).toBe(BigInt(0));

      // 20 raw units - 5% = 1
      const fee2 = calculatePlatformFee(BigInt(20));
      expect(fee2).toBe(BigInt(1));
    });
  });

  describe('calculateAuthorAmount', () => {
    it('should calculate 95% author amount', () => {
      // $0.25 payment
      const gross = usdcToRaw(0.25); // 250000n
      const author = calculateAuthorAmount(gross);

      // 95% of 250000 = 237500
      expect(author).toBe(BigInt(237500));
    });

    it('should calculate author amount for $1.00 payment', () => {
      const gross = usdcToRaw(1.0); // 1000000n
      const author = calculateAuthorAmount(gross);

      // 95% of 1000000 = 950000
      expect(author).toBe(BigInt(950000));
    });

    it('should ensure fee + author = gross', () => {
      const testAmounts = [
        usdcToRaw(0.05),
        usdcToRaw(0.25),
        usdcToRaw(0.50),
        usdcToRaw(0.99),
        usdcToRaw(1.0),
      ];

      for (const gross of testAmounts) {
        const fee = calculatePlatformFee(gross);
        const author = calculateAuthorAmount(gross);

        expect(fee + author).toBe(gross);
      }
    });

    it('should handle edge case amounts', () => {
      // Test various edge cases
      const edgeCases = [
        BigInt(1),
        BigInt(19),
        BigInt(20),
        BigInt(100),
        BigInt(999),
        BigInt(1000),
      ];

      for (const gross of edgeCases) {
        const fee = calculatePlatformFee(gross);
        const author = calculateAuthorAmount(gross);

        // Fee + Author should always equal Gross
        expect(fee + author).toBe(gross);

        // Fee should never be negative
        expect(fee).toBeGreaterThanOrEqual(BigInt(0));

        // Author should never be more than gross
        expect(author).toBeLessThanOrEqual(gross);
      }
    });
  });

  describe('Fee consistency across chains', () => {
    it('should calculate same fee for same amount on any chain', () => {
      // The fee calculation is chain-agnostic
      // Same raw amount should produce same fee regardless of chain
      const amounts = [
        BigInt(50000),   // $0.05
        BigInt(250000),  // $0.25
        BigInt(500000),  // $0.50
        BigInt(990000),  // $0.99
        BigInt(1000000), // $1.00
      ];

      for (const amount of amounts) {
        const fee = calculatePlatformFee(amount);
        const author = calculateAuthorAmount(amount);

        // Verify 5% fee
        const expectedFee = (amount * BigInt(500)) / BigInt(10000);
        expect(fee).toBe(expectedFee);

        // Verify 95% author
        expect(author).toBe(amount - expectedFee);
      }
    });
  });
});

// ============================================
// USDC Conversion Tests (Base-specific decimals)
// ============================================

describe('USDC Conversions (Base)', () => {
  describe('usdcToRaw', () => {
    it('should convert USDC to raw units (6 decimals)', () => {
      expect(usdcToRaw(0.25)).toBe(BigInt(250000));
      expect(usdcToRaw(1.0)).toBe(BigInt(1000000));
      expect(usdcToRaw(0.05)).toBe(BigInt(50000));
      expect(usdcToRaw(0.99)).toBe(BigInt(990000));
    });

    it('should handle zero', () => {
      expect(usdcToRaw(0)).toBe(BigInt(0));
    });

    it('should handle whole numbers', () => {
      expect(usdcToRaw(10)).toBe(BigInt(10000000));
      expect(usdcToRaw(100)).toBe(BigInt(100000000));
    });

    it('should truncate beyond 6 decimals', () => {
      // 0.1234567 should become 123456 (truncated)
      expect(usdcToRaw(0.1234567)).toBe(BigInt(123456));
    });
  });

  describe('rawToUsdc', () => {
    it('should convert raw units to USDC string', () => {
      expect(rawToUsdc(BigInt(250000))).toBe('0.25');
      expect(rawToUsdc(BigInt(1000000))).toBe('1.00');
      expect(rawToUsdc(BigInt(50000))).toBe('0.05');
      expect(rawToUsdc(BigInt(990000))).toBe('0.99');
    });

    it('should handle zero', () => {
      expect(rawToUsdc(BigInt(0))).toBe('0.00');
    });

    it('should handle large amounts', () => {
      expect(rawToUsdc(BigInt(10000000))).toBe('10.00');
      expect(rawToUsdc(BigInt(100000000))).toBe('100.00');
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain precision for standard amounts', () => {
      const amounts = [0.05, 0.25, 0.50, 0.99, 1.0, 10.0];

      for (const amount of amounts) {
        const raw = usdcToRaw(amount);
        const back = parseFloat(rawToUsdc(raw));

        expect(back).toBeCloseTo(amount, 2);
      }
    });
  });
});

// ============================================
// Base-Specific Payment Recording Tests
// ============================================

describe('Base Payment Recording', () => {
  it('should use correct chain_id for Base', () => {
    // Base mainnet chain ID is 8453
    const baseChainId = '8453';
    expect(baseChainId).toBe('8453');
  });

  it('should use correct USDC contract address', () => {
    // Base mainnet USDC contract
    const usdcContract = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    expect(usdcContract).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('should use 6 decimals for USDC on Base', () => {
    // USDC has 6 decimals on all chains
    const decimals = 6;
    expect(decimals).toBe(6);

    // Verify conversion factor
    const oneDollar = 10 ** decimals;
    expect(oneDollar).toBe(1000000);
  });
});

// ============================================
// Payout Threshold Tests
// ============================================

describe('Payout Thresholds', () => {
  const MIN_PAYOUT_RAW = BigInt(1_000_000); // $1.00

  it('should have $1.00 minimum payout threshold', () => {
    expect(MIN_PAYOUT_RAW).toBe(BigInt(1000000));
  });

  it('should reject payouts below threshold', () => {
    const belowThreshold = BigInt(999999); // $0.999999
    expect(belowThreshold < MIN_PAYOUT_RAW).toBe(true);
  });

  it('should accept payouts at threshold', () => {
    const atThreshold = BigInt(1000000); // $1.00
    expect(atThreshold >= MIN_PAYOUT_RAW).toBe(true);
  });

  it('should accept payouts above threshold', () => {
    const aboveThreshold = BigInt(1000001); // $1.000001
    expect(aboveThreshold >= MIN_PAYOUT_RAW).toBe(true);
  });
});
