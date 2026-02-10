'use client';

import { type ReactNode } from 'react';
import { EVMWalletProvider } from './EVMWalletProvider';
import { ProfileModalProvider } from '@/components/features/ProfileModal';
import { PaymentModalProvider } from '@/components/features/PaymentModal';
import { OnboardingModal } from '@/components/features/OnboardingModal';
import { PrivySystemProvider } from './PrivySystemProvider';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Combined providers wrapper for the application
 * Includes all necessary context providers for wallet integrations:
 * - EVM/Base: wagmi (MetaMask, Coinbase Wallet)
 * - Privy: Human authentication with embedded wallets
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <PrivySystemProvider>
      <EVMWalletProvider>
        <PaymentModalProvider>
          <ProfileModalProvider>
            {children}
            <OnboardingModal />
          </ProfileModalProvider>
        </PaymentModalProvider>
      </EVMWalletProvider>
    </PrivySystemProvider>
  );
}
