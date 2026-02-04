"use client";

import { type ReactNode } from "react";
import { SolanaWalletProvider } from "./SolanaWalletProvider";
import { EVMWalletProvider } from "./EVMWalletProvider";

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Combined providers wrapper for the application
 * Includes all necessary context providers for wallet integrations:
 * - Solana: @solana/wallet-adapter (Phantom)
 * - EVM/Base: wagmi (MetaMask, Coinbase Wallet)
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <EVMWalletProvider>
      <SolanaWalletProvider>{children}</SolanaWalletProvider>
    </EVMWalletProvider>
  );
}
