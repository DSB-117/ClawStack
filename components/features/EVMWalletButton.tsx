'use client';

import { useCallback, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isBaseChain, BASE_CHAIN_ID } from '@/lib/evm/config';

interface EVMWalletButtonProps {
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

/**
 * EVM Wallet Connect Button
 * Supports MetaMask and Coinbase Wallet for Base network
 */
export function EVMWalletButton({
  className,
  size = 'default',
}: EVMWalletButtonProps) {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [showConnectorList, setShowConnectorList] = useState(false);

  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  const isWrongChain = isConnected && !isBaseChain(chainId);

  const handleConnect = useCallback(
    (connectorId: string) => {
      const connector = connectors.find((c) => c.id === connectorId);
      if (connector) {
        connect({ connector, chainId: BASE_CHAIN_ID });
        setShowConnectorList(false);
      }
    },
    [connectors, connect]
  );

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const toggleConnectorList = useCallback(() => {
    setShowConnectorList((prev) => !prev);
  }, []);

  if (isConnecting || isPending) {
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

  if (isConnected && displayAddress) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#0052FF]/10 text-[#0052FF] text-sm font-medium">
          <span className="text-lg">Ⓑ</span>
          <span>{displayAddress}</span>
          {isWrongChain && (
            <span className="text-xs text-destructive ml-1">(Wrong chain)</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleDisconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        onClick={toggleConnectorList}
        variant="outline"
        size={size}
        className={cn(
          'min-w-[140px] border-[#0052FF]/30 hover:border-[#0052FF] hover:bg-[#0052FF]/5',
          className
        )}
      >
        <span className="flex items-center gap-2">
          <span className="text-[#0052FF]">Ⓑ</span>
          Connect Base
        </span>
      </Button>

      {/* Connector Selection Dropdown */}
      {showConnectorList && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[200px] p-2 rounded-lg border border-border bg-card shadow-lg z-50">
          <p className="text-xs text-muted-foreground px-2 py-1 mb-1">
            Select wallet:
          </p>
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => handleConnect(connector.id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left transition-colors"
            >
              <ConnectorIcon connectorId={connector.id} />
              <span className="font-medium text-sm">{connector.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for headers/navbars
 */
export function EVMWalletButtonCompact({ className }: { className?: string }) {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [showConnectorList, setShowConnectorList] = useState(false);

  const displayAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  const isWrongChain = isConnected && !isBaseChain(chainId);

  const handleConnect = useCallback(
    (connectorId: string) => {
      const connector = connectors.find((c) => c.id === connectorId);
      if (connector) {
        connect({ connector, chainId: BASE_CHAIN_ID });
        setShowConnectorList(false);
      }
    },
    [connectors, connect]
  );

  const handleClick = useCallback(() => {
    if (isConnected) {
      disconnect();
    } else {
      setShowConnectorList((prev) => !prev);
    }
  }, [isConnected, disconnect]);

  return (
    <div className="relative">
      <Button
        onClick={handleClick}
        variant={isConnected ? 'ghost' : 'outline'}
        size="sm"
        disabled={isConnecting || isPending}
        className={cn(isConnected && 'text-[#0052FF]', className)}
      >
        {isConnecting || isPending ? (
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
        ) : isConnected ? (
          <span className="flex items-center gap-1.5">
            <span>Ⓑ</span>
            {displayAddress}
            {isWrongChain && <span className="text-destructive">!</span>}
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="text-[#0052FF]">Ⓑ</span>
            Base
          </span>
        )}
      </Button>

      {/* Connector Selection Dropdown */}
      {showConnectorList && !isConnected && (
        <div className="absolute top-full right-0 mt-2 min-w-[180px] p-2 rounded-lg border border-border bg-card shadow-lg z-50">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => handleConnect(connector.id)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-left transition-colors text-sm"
            >
              <ConnectorIcon connectorId={connector.id} size={16} />
              <span>{connector.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Connector icon component
 */
function ConnectorIcon({
  connectorId,
  size = 20,
}: {
  connectorId: string;
  size?: number;
}) {
  // MetaMask fox icon (simplified SVG)
  if (connectorId === 'injected' || connectorId === 'metaMask') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M21.3 3L13.5 8.7L14.9 5.3L21.3 3Z"
          fill="#E17726"
          stroke="#E17726"
          strokeWidth="0.25"
        />
        <path
          d="M2.7 3L10.4 8.8L9.1 5.3L2.7 3Z"
          fill="#E27625"
          stroke="#E27625"
          strokeWidth="0.25"
        />
        <path
          d="M18.4 16.4L16.3 19.6L20.8 20.9L22.2 16.5L18.4 16.4Z"
          fill="#E27625"
          stroke="#E27625"
          strokeWidth="0.25"
        />
        <path
          d="M1.8 16.5L3.2 20.9L7.7 19.6L5.6 16.4L1.8 16.5Z"
          fill="#E27625"
          stroke="#E27625"
          strokeWidth="0.25"
        />
        <path
          d="M7.5 10.7L6.1 12.8L10.5 13L10.3 8.3L7.5 10.7Z"
          fill="#E27625"
          stroke="#E27625"
          strokeWidth="0.25"
        />
        <path
          d="M16.5 10.7L13.6 8.2L13.5 13L17.9 12.8L16.5 10.7Z"
          fill="#E27625"
          stroke="#E27625"
          strokeWidth="0.25"
        />
        <path
          d="M7.7 19.6L10.2 18.4L8 16.5L7.7 19.6Z"
          fill="#E27625"
          stroke="#E27625"
          strokeWidth="0.25"
        />
        <path
          d="M13.8 18.4L16.3 19.6L16 16.5L13.8 18.4Z"
          fill="#E27625"
          stroke="#E27625"
          strokeWidth="0.25"
        />
      </svg>
    );
  }

  // Coinbase Wallet icon
  if (connectorId === 'coinbaseWalletSDK' || connectorId === 'coinbaseWallet') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="24" height="24" rx="6" fill="#0052FF" />
        <path
          d="M12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C16.42 20 20 16.42 20 12C20 7.58 16.42 4 12 4ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17Z"
          fill="white"
        />
        <rect x="10" y="10" width="4" height="4" rx="1" fill="white" />
      </svg>
    );
  }

  // Default wallet icon
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}
