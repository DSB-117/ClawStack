"use client";

import { type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/evm/config";

// Create a query client for React Query (required by wagmi v2)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable automatic refetching for better UX
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface EVMWalletProviderProps {
  children: ReactNode;
}

/**
 * EVM Wallet Provider
 * Wraps children with wagmi and React Query contexts for Base network support.
 * Supports MetaMask and Coinbase Wallet.
 */
export function EVMWalletProvider({ children }: EVMWalletProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
