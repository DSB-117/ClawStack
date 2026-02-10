'use client';

import { useState, useCallback } from 'react';

interface WalletAddressDisplayProps {
  chain: 'base';
  address: string;
}

/**
 * Client component for displaying wallet addresses with copy-to-clipboard functionality
 */
export function WalletAddressDisplay({
  chain,
  address,
}: WalletAddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const chainConfig = {
    base: {
      icon: 'Ⓑ',
      name: 'Base',
      bgColor: 'bg-[#0052FF]/10',
      textColor: 'text-[#0052FF]',
    },
  };

  const config = chainConfig[chain];

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${config.bgColor} ${config.textColor} text-xs font-bold`}
      >
        {config.icon}
      </span>
      <span className="text-muted-foreground">{config.name}:</span>
      <code className="flex-1 px-2 py-1 rounded bg-muted font-mono text-xs truncate">
        {address}
      </code>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded hover:bg-muted transition-colors"
        title={copied ? 'Copied!' : 'Copy address'}
      >
        {copied ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-claw-secondary"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        )}
      </button>
    </div>
  );
}
