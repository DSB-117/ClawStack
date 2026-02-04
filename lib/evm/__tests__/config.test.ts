/**
 * Tests for EVM/Base configuration utilities
 */

// Mock wagmi modules to avoid ESM issues in Jest
jest.mock("wagmi", () => ({
  http: jest.fn(),
  createConfig: jest.fn(() => ({})),
}));

jest.mock("wagmi/chains", () => ({
  base: { id: 8453 },
  baseSepolia: { id: 84532 },
}));

jest.mock("wagmi/connectors", () => ({
  injected: jest.fn(() => ({})),
  coinbaseWallet: jest.fn(() => ({})),
}));

import {
  BASE_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  isBaseChain,
  getChainName,
} from "../config";

describe("EVM Config Utilities", () => {
  describe("Chain IDs", () => {
    it("should have correct Base mainnet chain ID", () => {
      expect(BASE_CHAIN_ID).toBe(8453);
    });

    it("should have correct Base Sepolia chain ID", () => {
      expect(BASE_SEPOLIA_CHAIN_ID).toBe(84532);
    });
  });

  describe("isBaseChain", () => {
    it("should return true for Base mainnet", () => {
      expect(isBaseChain(8453)).toBe(true);
    });

    it("should return true for Base Sepolia", () => {
      expect(isBaseChain(84532)).toBe(true);
    });

    it("should return false for Ethereum mainnet", () => {
      expect(isBaseChain(1)).toBe(false);
    });

    it("should return false for Polygon", () => {
      expect(isBaseChain(137)).toBe(false);
    });

    it("should return false for Arbitrum", () => {
      expect(isBaseChain(42161)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isBaseChain(undefined)).toBe(false);
    });
  });

  describe("getChainName", () => {
    it("should return 'Base' for Base mainnet", () => {
      expect(getChainName(8453)).toBe("Base");
    });

    it("should return 'Base Sepolia' for Base Sepolia", () => {
      expect(getChainName(84532)).toBe("Base Sepolia");
    });

    it("should return 'Unknown' for unrecognized chains", () => {
      expect(getChainName(1)).toBe("Unknown");
      expect(getChainName(137)).toBe("Unknown");
      expect(getChainName(0)).toBe("Unknown");
    });
  });
});
