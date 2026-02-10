/**
 * Fee Split Edge Case Tests
 *
 * Comprehensive tests for fee calculation edge cases to ensure
 * no rounding errors or lost/extra cents.
 *
 * @see claude/operations/tasks.md Task 2.4.7
 */

import {
  calculatePlatformFee,
  calculateAuthorAmount,
  usdcToRaw,
  rawToUsdc,
} from '../index';

describe('Fee Split Edge Cases (Task 2.4.7)', () => {
  // Store original env
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      PLATFORM_FEE_BPS: '500', // 5%
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Minimum Price ($0.05)', () => {
    const grossRaw = usdcToRaw(0.05); // 50000 raw units

    it('calculates correct platform fee', () => {
      const fee = calculatePlatformFee(grossRaw);
      // 5% of 50000 = 2500
      expect(fee).toBe(BigInt(2500));
    });

    it('calculates correct author amount', () => {
      const author = calculateAuthorAmount(grossRaw);
      // 95% of 50000 = 47500
      expect(author).toBe(BigInt(47500));
    });

    it('fee + author equals gross (no lost cents)', () => {
      const fee = calculatePlatformFee(grossRaw);
      const author = calculateAuthorAmount(grossRaw);
      expect(fee + author).toBe(grossRaw);
    });

    it('converts back to USDC correctly', () => {
      const fee = calculatePlatformFee(grossRaw);
      const author = calculateAuthorAmount(grossRaw);

      // Platform fee: $0.0025 (displayed as $0.00 when rounded)
      expect(rawToUsdc(fee)).toBe('0.00');
      // Author: $0.0475 (displayed as $0.05 when rounded)
      expect(rawToUsdc(author)).toBe('0.05');
    });
  });

  describe('Maximum Price ($0.99)', () => {
    const grossRaw = usdcToRaw(0.99); // 990000 raw units

    it('calculates correct platform fee', () => {
      const fee = calculatePlatformFee(grossRaw);
      // 5% of 990000 = 49500
      expect(fee).toBe(BigInt(49500));
    });

    it('calculates correct author amount', () => {
      const author = calculateAuthorAmount(grossRaw);
      // 95% of 990000 = 940500
      expect(author).toBe(BigInt(940500));
    });

    it('fee + author equals gross (no lost cents)', () => {
      const fee = calculatePlatformFee(grossRaw);
      const author = calculateAuthorAmount(grossRaw);
      expect(fee + author).toBe(grossRaw);
    });

    it('converts back to USDC correctly', () => {
      const fee = calculatePlatformFee(grossRaw);
      const author = calculateAuthorAmount(grossRaw);

      expect(rawToUsdc(fee)).toBe('0.05'); // $0.0495 -> $0.05
      expect(rawToUsdc(author)).toBe('0.94'); // $0.9405 -> $0.94
    });
  });

  describe('Common Prices', () => {
    const testCases = [
      { usdc: 0.10, grossRaw: 100000, expectedFee: 5000, expectedAuthor: 95000 },
      { usdc: 0.25, grossRaw: 250000, expectedFee: 12500, expectedAuthor: 237500 },
      { usdc: 0.50, grossRaw: 500000, expectedFee: 25000, expectedAuthor: 475000 },
      { usdc: 0.75, grossRaw: 750000, expectedFee: 37500, expectedAuthor: 712500 },
    ];

    testCases.forEach(({ usdc, grossRaw, expectedFee, expectedAuthor }) => {
      describe(`$${usdc.toFixed(2)} payment`, () => {
        it(`platform fee is ${expectedFee} raw units`, () => {
          const fee = calculatePlatformFee(BigInt(grossRaw));
          expect(fee).toBe(BigInt(expectedFee));
        });

        it(`author amount is ${expectedAuthor} raw units`, () => {
          const author = calculateAuthorAmount(BigInt(grossRaw));
          expect(author).toBe(BigInt(expectedAuthor));
        });

        it('no rounding error', () => {
          const fee = calculatePlatformFee(BigInt(grossRaw));
          const author = calculateAuthorAmount(BigInt(grossRaw));
          expect(fee + author).toBe(BigInt(grossRaw));
        });
      });
    });
  });

  describe('Multiple Payments Accumulation', () => {
    it('multiple small payments total correctly', () => {
      // Simulate 10 x $0.10 payments
      const singlePayment = usdcToRaw(0.10);
      let totalGross = BigInt(0);
      let totalFees = BigInt(0);
      let totalAuthor = BigInt(0);

      for (let i = 0; i < 10; i++) {
        totalGross += singlePayment;
        totalFees += calculatePlatformFee(singlePayment);
        totalAuthor += calculateAuthorAmount(singlePayment);
      }

      // Total should be $1.00
      expect(totalGross).toBe(BigInt(1000000));

      // Fees should be exactly 5%
      expect(totalFees).toBe(BigInt(50000)); // $0.05

      // Author should be exactly 95%
      expect(totalAuthor).toBe(BigInt(950000)); // $0.95

      // No lost cents
      expect(totalFees + totalAuthor).toBe(totalGross);
    });

    it('mixed payment sizes total correctly', () => {
      const payments = [
        usdcToRaw(0.05), // min
        usdcToRaw(0.25),
        usdcToRaw(0.50),
        usdcToRaw(0.99), // max
      ];

      let totalGross = BigInt(0);
      let totalFees = BigInt(0);
      let totalAuthor = BigInt(0);

      for (const payment of payments) {
        totalGross += payment;
        totalFees += calculatePlatformFee(payment);
        totalAuthor += calculateAuthorAmount(payment);
      }

      // Verify no rounding errors across all payments
      expect(totalFees + totalAuthor).toBe(totalGross);

      // Verify fee ratio is exactly 5%
      const feeRatio = Number(totalFees) / Number(totalGross);
      expect(feeRatio).toBe(0.05);
    });

    it('large number of payments maintains precision', () => {
      // Simulate 1000 minimum payments
      const singlePayment = usdcToRaw(0.05);
      let totalGross = BigInt(0);
      let totalFees = BigInt(0);
      let totalAuthor = BigInt(0);

      for (let i = 0; i < 1000; i++) {
        totalGross += singlePayment;
        totalFees += calculatePlatformFee(singlePayment);
        totalAuthor += calculateAuthorAmount(singlePayment);
      }

      // Total should be $50
      expect(totalGross).toBe(BigInt(50000000));

      // No accumulation errors
      expect(totalFees + totalAuthor).toBe(totalGross);

      // Fee ratio still exactly 5%
      const feeRatio = Number(totalFees) / Number(totalGross);
      expect(feeRatio).toBe(0.05);
    });
  });

  describe('Integer Division Behavior', () => {
    it('handles amounts that divide evenly', () => {
      // 1000000 (1 USDC) / 100 * 5 = 50000 exactly
      const gross = BigInt(1000000);
      const fee = calculatePlatformFee(gross);
      const author = calculateAuthorAmount(gross);

      expect(fee).toBe(BigInt(50000));
      expect(author).toBe(BigInt(950000));
      expect(fee + author).toBe(gross);
    });

    it('truncates fractional raw units (platform loses)', () => {
      // For amounts that don't divide evenly by 10000,
      // BigInt division truncates (rounds toward zero).
      // This means the platform may get slightly less.

      // Example: 1 raw unit
      // 1 * 500 / 10000 = 0 (truncated)
      const tinyAmount = BigInt(1);
      const fee = calculatePlatformFee(tinyAmount);

      expect(fee).toBe(BigInt(0)); // Fee rounds to 0
      expect(calculateAuthorAmount(tinyAmount)).toBe(BigInt(1)); // Author gets all
    });

    it('very small amounts favor author (no negative fees)', () => {
      // Any amount less than 200 raw units (0.0002 USDC) results in 0 fee
      // 199 * 500 / 10000 = 9.95 -> 9 (not 0, actually)
      const smallAmounts = [BigInt(1), BigInt(19), BigInt(199)];

      for (const amount of smallAmounts) {
        const fee = calculatePlatformFee(amount);
        const author = calculateAuthorAmount(amount);

        // Fee should never be negative
        expect(fee).toBeGreaterThanOrEqual(BigInt(0));

        // Author should always get at least 0
        expect(author).toBeGreaterThanOrEqual(BigInt(0));

        // Sum should equal original
        expect(fee + author).toBe(amount);
      }
    });
  });

  describe('USDC Conversion Round-Trip', () => {
    it('converts to raw and back without loss for standard amounts', () => {
      const amounts = [0.05, 0.10, 0.25, 0.50, 0.75, 0.99];

      for (const usdc of amounts) {
        const raw = usdcToRaw(usdc);
        const backToUsdc = rawToUsdc(raw);

        expect(backToUsdc).toBe(usdc.toFixed(2));
      }
    });

    it('handles sub-cent amounts in raw form', () => {
      // 12345 raw = $0.012345
      const raw = BigInt(12345);
      const usdc = rawToUsdc(raw);

      // Should round to 2 decimal places
      expect(usdc).toBe('0.01');
    });
  });

  describe('Boundary Values', () => {
    it('handles zero amount gracefully', () => {
      const zero = BigInt(0);

      expect(calculatePlatformFee(zero)).toBe(BigInt(0));
      expect(calculateAuthorAmount(zero)).toBe(BigInt(0));
    });

    it('handles maximum safe integer', () => {
      // Maximum USDC that can be safely represented
      // In practice, this would be millions of dollars
      const largeAmount = BigInt(1000000000000); // $1,000,000

      const fee = calculatePlatformFee(largeAmount);
      const author = calculateAuthorAmount(largeAmount);

      expect(fee).toBe(BigInt(50000000000)); // $50,000
      expect(author).toBe(BigInt(950000000000)); // $950,000
      expect(fee + author).toBe(largeAmount);
    });
  });
});
