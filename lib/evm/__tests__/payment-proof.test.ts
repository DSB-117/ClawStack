/**
 * Tests for EVM payment proof utilities
 */
import {
  createEVMPaymentProof,
  validateEVMPaymentProof,
  isValidEVMAddress,
  isValidEVMTransactionHash,
  type EVMPaymentProof,
} from "../payment-proof";

describe("EVM Payment Proof Utilities", () => {
  describe("createEVMPaymentProof", () => {
    it("should create a valid payment proof object", () => {
      const hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const payerAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D";
      const blockTimestamp = 1706960000;

      const proof = createEVMPaymentProof(hash, payerAddress, blockTimestamp);

      expect(proof).toEqual({
        chain: "base",
        transaction_signature: hash,
        payer_address: payerAddress,
        timestamp: blockTimestamp,
      });
    });

    it("should use current time if blockTimestamp is null", () => {
      const before = Math.floor(Date.now() / 1000);
      const proof = createEVMPaymentProof(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D",
        null
      );
      const after = Math.floor(Date.now() / 1000);

      expect(proof.timestamp).toBeGreaterThanOrEqual(before);
      expect(proof.timestamp).toBeLessThanOrEqual(after);
    });

    it("should always set chain to base", () => {
      const proof = createEVMPaymentProof(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D",
        1706960000
      );
      expect(proof.chain).toBe("base");
    });
  });

  describe("validateEVMPaymentProof", () => {
    const validProof: EVMPaymentProof = {
      chain: "base",
      transaction_signature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      payer_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D",
      timestamp: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
    };

    it("should validate a correct proof", () => {
      const result = validateEVMPaymentProof(validProof);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject proof with missing transaction hash", () => {
      const proof = { ...validProof, transaction_signature: "" };
      const result = validateEVMPaymentProof(proof);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Missing transaction hash");
    });

    it("should reject proof with missing payer address", () => {
      const proof = { ...validProof, payer_address: "" };
      const result = validateEVMPaymentProof(proof);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Missing payer address");
    });

    it("should reject proof with invalid transaction hash format (no 0x prefix)", () => {
      const proof = {
        ...validProof,
        transaction_signature: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      };
      const result = validateEVMPaymentProof(proof);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid transaction hash format");
    });

    it("should reject proof with invalid transaction hash format (wrong length)", () => {
      const proof = {
        ...validProof,
        transaction_signature: "0x1234567890abcdef", // Too short
      };
      const result = validateEVMPaymentProof(proof);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid transaction hash format");
    });

    it("should reject proof with invalid payer address format (no 0x prefix)", () => {
      const proof = {
        ...validProof,
        payer_address: "742d35Cc6634C0532925a3b844Bc9e7595f8fE3D",
      };
      const result = validateEVMPaymentProof(proof);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid payer address format");
    });

    it("should reject proof with invalid payer address format (wrong length)", () => {
      const proof = {
        ...validProof,
        payer_address: "0x742d35Cc", // Too short
      };
      const result = validateEVMPaymentProof(proof);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid payer address format");
    });

    it("should reject proof with future timestamp", () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 600; // 10 minutes in future
      const proof = { ...validProof, timestamp: futureTimestamp };
      const result = validateEVMPaymentProof(proof);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid timestamp");
    });

    it("should accept proof with near-future timestamp (within 5 min tolerance)", () => {
      const nearFuture = Math.floor(Date.now() / 1000) + 60; // 1 minute in future
      const proof = { ...validProof, timestamp: nearFuture };
      const result = validateEVMPaymentProof(proof);
      expect(result.valid).toBe(true);
    });
  });

  describe("isValidEVMAddress", () => {
    it("should return true for valid addresses", () => {
      const validAddresses = [
        "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D",
        "0x0000000000000000000000000000000000000000",
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      ];

      for (const address of validAddresses) {
        expect(isValidEVMAddress(address)).toBe(true);
      }
    });

    it("should return false for invalid addresses", () => {
      const invalidAddresses = [
        "",
        "not-a-valid-address",
        "742d35Cc6634C0532925a3b844Bc9e7595f8fE3D", // Missing 0x
        "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3", // Too short
        "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3DD", // Too long
        "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", // Invalid hex
        "7sK9xABC123DEF456GHI789JKLmnopqrstuvwxyz12", // Solana address
      ];

      for (const address of invalidAddresses) {
        expect(isValidEVMAddress(address)).toBe(false);
      }
    });
  });

  describe("isValidEVMTransactionHash", () => {
    it("should return true for valid transaction hashes", () => {
      const validHashes = [
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
      ];

      for (const hash of validHashes) {
        expect(isValidEVMTransactionHash(hash)).toBe(true);
      }
    });

    it("should return false for invalid transaction hashes", () => {
      const invalidHashes = [
        "",
        "not-a-valid-hash",
        "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", // Missing 0x
        "0x1234567890abcdef", // Too short
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefAA", // Too long
        "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", // Invalid hex
      ];

      for (const hash of invalidHashes) {
        expect(isValidEVMTransactionHash(hash)).toBe(false);
      }
    });
  });
});

describe("EVM Payment Proof Storage", () => {
  beforeEach(() => {
    // Mock localStorage
    const mockStorage: Record<string, string> = {};
    global.localStorage = {
      getItem: jest.fn((key: string) => mockStorage[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: jest.fn(() => {
        Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
      }),
      length: 0,
      key: jest.fn(),
    } as Storage;
  });

  it("should be able to store EVM payment proof", async () => {
    const { storeEVMPaymentProof, getStoredEVMPaymentProof } = await import(
      "../payment-proof"
    );

    const proof: EVMPaymentProof = {
      chain: "base",
      transaction_signature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      payer_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D",
      timestamp: Math.floor(Date.now() / 1000),
    };

    storeEVMPaymentProof("post_123", proof);
    const retrieved = getStoredEVMPaymentProof("post_123");

    expect(retrieved).toEqual(proof);
  });

  it("should return null for non-existent proof", async () => {
    const { getStoredEVMPaymentProof } = await import("../payment-proof");

    const retrieved = getStoredEVMPaymentProof("non_existent_post");
    expect(retrieved).toBeNull();
  });

  it("should clear stored proof", async () => {
    const {
      storeEVMPaymentProof,
      getStoredEVMPaymentProof,
      clearStoredEVMPaymentProof,
    } = await import("../payment-proof");

    const proof: EVMPaymentProof = {
      chain: "base",
      transaction_signature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      payer_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE3D",
      timestamp: Math.floor(Date.now() / 1000),
    };

    storeEVMPaymentProof("post_456", proof);
    clearStoredEVMPaymentProof("post_456");
    const retrieved = getStoredEVMPaymentProof("post_456");

    expect(retrieved).toBeNull();
  });
});
