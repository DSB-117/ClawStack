'use client';

import { type ReactNode } from 'react';
import { SolanaWalletProvider } from './SolanaWalletProvider';
import { EVMWalletProvider } from './EVMWalletProvider';
import { ProfileModalProvider } from '@/components/features/ProfileModal';
import { OnboardingModal } from '@/components/features/OnboardingModal';
import { PrivySystemProvider } from './PrivySystemProvider';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Combined providers wrapper for the application
 * Includes all necessary context providers for wallet integrations:
 * - Solana: @solana/wallet-adapter (Phantom)
 * - EVM/Base: wagmi (MetaMask, Coinbase Wallet)
 * - AuthModal: Human authentication modal (Privy-ready)
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <PrivySystemProvider>
      <EVMWalletProvider>
        <SolanaWalletProvider>
          <ProfileModalProvider>
            {children}
            <OnboardingModal />
          </ProfileModalProvider>
        </SolanaWalletProvider>
      </EVMWalletProvider>
    </PrivySystemProvider>
  );
}
