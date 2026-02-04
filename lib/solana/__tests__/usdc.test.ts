/**
 * Tests for Solana USDC utilities
 */
import { PublicKey } from "@solana/web3.js";
import {
  usdcToAtomic,
  atomicToUsdc,
  USDC_DECIMALS,
  USDC_MINT,
  isValidSolanaAddress,
} from "../usdc";

describe("USDC Utilities", () => {
  describe("usdcToAtomic", () => {
    it("should convert whole USDC to atomic units", () => {
      expect(usdcToAtomic(1)).toBe(BigInt(1_000_000));
      expect(usdcToAtomic(10)).toBe(BigInt(10_000_000));
      expect(usdcToAtomic(100)).toBe(BigInt(100_000_000));
    });

    it("should convert fractional USDC to atomic units", () => {
      expect(usdcToAtomic(0.25)).toBe(BigInt(250_000));
      expect(usdcToAtomic(0.05)).toBe(BigInt(50_000));
      expect(usdcToAtomic(0.99)).toBe(BigInt(990_000));
    });

    it("should handle very small amounts", () => {
      expect(usdcToAtomic(0.000001)).toBe(BigInt(1));
    });

    it("should handle zero", () => {
      expect(usdcToAtomic(0)).toBe(BigInt(0));
    });

    it("should round to nearest atomic unit", () => {
      // 0.0000001 USDC should round to 0 atomic units
      expect(usdcToAtomic(0.0000001)).toBe(BigInt(0));
      // 0.0000005 USDC should round to 1 atomic unit
      expect(usdcToAtomic(0.0000005)).toBe(BigInt(1));
    });
  });

  describe("atomicToUsdc", () => {
    it("should convert atomic units to USDC", () => {
      expect(atomicToUsdc(BigInt(1_000_000))).toBe(1);
      expect(atomicToUsdc(BigInt(10_000_000))).toBe(10);
      expect(atomicToUsdc(BigInt(250_000))).toBe(0.25);
    });

    it("should handle zero", () => {
      expect(atomicToUsdc(BigInt(0))).toBe(0);
    });

    it("should handle single atomic unit", () => {
      expect(atomicToUsdc(BigInt(1))).toBe(0.000001);
    });
  });

  describe("Round-trip conversion", () => {
    it("should maintain value through conversion round-trip", () => {
      const testValues = [0.05, 0.10, 0.25, 0.50, 0.99, 1.00, 10.00, 100.00];

      for (const value of testValues) {
        const atomic = usdcToAtomic(value);
        const backToUsdc = atomicToUsdc(atomic);
        expect(backToUsdc).toBeCloseTo(value, USDC_DECIMALS);
      }
    });
  });

  describe("Constants", () => {
    it("should have correct USDC decimals", () => {
      expect(USDC_DECIMALS).toBe(6);
    });

    it("should have valid USDC mint address", () => {
      expect(USDC_MINT).toBeInstanceOf(PublicKey);
      expect(USDC_MINT.toBase58()).toBe(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      );
    });
  });

  describe("isValidSolanaAddress", () => {
    it("should return true for valid addresses", () => {
      const validAddresses = [
        // System Program
        "11111111111111111111111111111111",
        // USDC Mint
        USDC_MINT.toBase58(),
        // Token Program
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      ];

      for (const address of validAddresses) {
        expect(isValidSolanaAddress(address)).toBe(true);
      }
    });

    it("should return false for invalid addresses", () => {
      const invalidAddresses = [
        "",
        "not-a-valid-address",
        "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D", // EVM address
        "too-short",
        "!!!invalid!!!",
        // Contains invalid base58 characters (0, O, I, l)
        "0OIl11111111111111111111111111111",
      ];

      for (const address of invalidAddresses) {
        expect(isValidSolanaAddress(address)).toBe(false);
      }
    });
  });
});
