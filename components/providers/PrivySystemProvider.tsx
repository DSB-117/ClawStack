'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { base } from 'viem/chains';

interface PrivySystemProviderProps {
  children: React.ReactNode;
}

export function PrivySystemProvider({ children }: PrivySystemProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    console.warn(
      'NEXT_PUBLIC_PRIVY_APP_ID is not set in environment variables'
    );
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['google', 'twitter', 'github'],
        appearance: {
          theme: 'dark',
          accentColor: '#FF5E1A', // claw-primary
          logo: 'https://api.dicebear.com/7.x/bottts/svg?seed=clawstack', // Placeholder logic
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
