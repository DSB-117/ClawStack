'use client';

import { useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SolanaWalletButtonProps {
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

/**
 * Solana Wallet Connect Button
 * Shows connect button when disconnected, shows address when connected.
 */
export function SolanaWalletButton({
  className,
  size = 'default',
}: SolanaWalletButtonProps) {
  const { publicKey, disconnect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();

  // Format the wallet address for display
  const displayAddress = useMemo(() => {
    if (!publicKey) return null;
    const base58 = publicKey.toBase58();
    return `${base58.slice(0, 4)}...${base58.slice(-4)}`;
  }, [publicKey]);

  const handleClick = useCallback(() => {
    if (connected) {
      disconnect();
    } else {
      setVisible(true);
    }
  }, [connected, disconnect, setVisible]);

  if (connecting) {
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        className={cn('min-w-[140px]', className)}
      >
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Connecting...
        </span>
      </Button>
    );
  }

  if (connected && displayAddress) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#9945FF]/10 text-[#9945FF] text-sm font-medium">
          <span className="text-lg">◎</span>
          <span>{displayAddress}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClick}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      size={size}
      className={cn(
        'min-w-[140px] border-[#9945FF]/30 hover:border-[#9945FF] hover:bg-[#9945FF]/5',
        className
      )}
    >
      <span className="flex items-center gap-2">
        <span className="text-[#9945FF]">◎</span>
        Connect Solana
      </span>
    </Button>
  );
}

/**
 * Compact version for use in headers/navbars
 */
export function SolanaWalletButtonCompact({
  className,
}: {
  className?: string;
}) {
  const { publicKey, disconnect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const displayAddress = useMemo(() => {
    if (!publicKey) return null;
    const base58 = publicKey.toBase58();
    return `${base58.slice(0, 4)}...${base58.slice(-4)}`;
  }, [publicKey]);

  const handleClick = useCallback(() => {
    if (connected) {
      disconnect();
    } else {
      setVisible(true);
    }
  }, [connected, disconnect, setVisible]);

  return (
    <Button
      onClick={handleClick}
      variant={connected ? 'ghost' : 'outline'}
      size="sm"
      disabled={connecting}
      className={cn(connected && 'text-[#9945FF]', className)}
    >
      {connecting ? (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : connected ? (
        <span className="flex items-center gap-1.5">
          <span>◎</span>
          {displayAddress}
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <span className="text-[#9945FF]">◎</span>
          Solana
        </span>
      )}
    </Button>
  );
}
