import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

/**
 * Wagmi configuration for Base network
 * Supports MetaMask (injected) and Coinbase Wallet connectors
 */
export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    // MetaMask and other injected wallets
    injected({
      shimDisconnect: true,
    }),
    // Coinbase Wallet
    coinbaseWallet({
      appName: "ClawStack",
      appLogoUrl: "https://clawstack.com/logo.png",
    }),
  ],
  transports: {
    // Use custom RPC if provided, otherwise use default public endpoints
    [base.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"
    ),
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
        "https://sepolia.base.org"
    ),
  },
});

// Re-export chain configurations
export { base, baseSepolia };

// Chain IDs for reference
export const BASE_CHAIN_ID = base.id; // 8453
export const BASE_SEPOLIA_CHAIN_ID = baseSepolia.id; // 84532

// Default chain (mainnet for production)
export const DEFAULT_CHAIN = base;

/**
 * Check if we're on the correct chain
 */
export function isBaseChain(chainId: number | undefined): boolean {
  return chainId === BASE_CHAIN_ID || chainId === BASE_SEPOLIA_CHAIN_ID;
}

/**
 * Get chain name from ID
 */
export function getChainName(chainId: number): string {
  switch (chainId) {
    case BASE_CHAIN_ID:
      return "Base";
    case BASE_SEPOLIA_CHAIN_ID:
      return "Base Sepolia";
    default:
      return "Unknown";
  }
}
