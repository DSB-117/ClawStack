"use client";

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// Import default styles for the wallet modal
import "@solana/wallet-adapter-react-ui/styles.css";

interface SolanaWalletProviderProps {
  children: ReactNode;
}

/**
 * Solana Wallet Provider
 * Wraps children with Solana connection and wallet context.
 * Configured for mainnet-beta by default, with Phantom wallet support.
 */
export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  // Configure the network endpoint
  // In production, use a dedicated RPC endpoint for better reliability
  const endpoint = useMemo(() => {
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (customRpc) return customRpc;
    // Default to mainnet-beta for production
    return clusterApiUrl("mainnet-beta");
  }, []);

  // Configure supported wallets
  // Phantom is the primary wallet for ClawStack
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      // Additional wallets can be added here:
      // new SolflareWalletAdapter(),
      // new TorusWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
