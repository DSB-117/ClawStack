"use client";

import { type ReactNode } from "react";
import { SolanaWalletProvider } from "./SolanaWalletProvider";

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Combined providers wrapper for the application
 * Includes all necessary context providers for wallet integrations
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <SolanaWalletProvider>
      {children}
    </SolanaWalletProvider>
  );
}
