'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { useBaseUsdcBalance, useEVMPayment } from '@/lib/evm/hooks';
import {
  createEVMPaymentProof,
  submitEVMPaymentProof,
  storeEVMPaymentProof,
} from '@/lib/evm/payment-proof';
import { BASE_CHAIN_ID } from '@/lib/evm/config';

interface EVMPaymentFlowProps {
  postId: string;
  priceUsdc: number;
  recipientAddress: string; // Author wallet address
  onSuccess: () => void;
  onError: (error: string) => void;
}

type FlowStep =
  | 'connect'
  | 'check-balance'
  | 'wrong-chain'
  | 'ready'
  | 'paying'
  | 'confirming'
  | 'submitting'
  | 'success'
  | 'error';

/**
 * Complete EVM/Base payment flow component
 * Handles wallet connection, chain switching, balance checking, payment, and proof submission
 */
export function EVMPaymentFlow({
  postId,
  priceUsdc,
  recipientAddress,
  onSuccess,
  onError,
}: EVMPaymentFlowProps) {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectors, connect } = useConnect();
  // const chainId = useChainId();
  const {
    balance,
    loading: balanceLoading,
    isWrongChain,
    refetch,
  } = useBaseUsdcBalance();
  const { state: paymentState, initiatePayment, reset } = useEVMPayment();

  const [step, setStep] = useState<FlowStep>('connect');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConnectors, setShowConnectors] = useState(false);

  // Determine current step based on state
  // This effect syncs derived state from external wagmi hooks - valid pattern
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!isConnected) {
      setStep('connect');
      return;
    }

    if (isWrongChain) {
      setStep('wrong-chain');
      return;
    }

    if (balanceLoading) {
      setStep('check-balance');
      return;
    }

    if (paymentState.status === 'idle') {
      setStep('ready');
      return;
    }

    if (
      paymentState.status === 'switching-chain' ||
      paymentState.status === 'preparing' ||
      paymentState.status === 'confirming-wallet'
    ) {
      setStep('paying');
      return;
    }

    if (paymentState.status === 'pending') {
      setStep('confirming');
      return;
    }

    if (paymentState.status === 'success') {
      setStep('submitting');
      return;
    }

    if (paymentState.status === 'error') {
      setStep('error');
      setErrorMessage(paymentState.error);
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isConnected, isWrongChain, balanceLoading, paymentState]);

  // Handle payment proof submission after transaction success
  useEffect(() => {
    async function submitProof() {
      if (step !== 'submitting' || !paymentState.hash || !address) {
        return;
      }

      const proof = createEVMPaymentProof(
        paymentState.hash,
        address,
        paymentState.blockNumber ? Number(paymentState.blockNumber) : null
      );

      // Store locally for session persistence
      storeEVMPaymentProof(postId, proof);

      // Submit to API
      const result = await submitEVMPaymentProof(postId, proof);

      if (result.success && result.accessGranted) {
        setStep('success');
        onSuccess();
      } else {
        setStep('error');
        setErrorMessage(result.error || 'Failed to verify payment');
        onError(result.error || 'Failed to verify payment');
      }
    }

    submitProof();
  }, [
    step,
    paymentState.hash,
    paymentState.blockNumber,
    address,
    postId,
    onSuccess,
    onError,
  ]);

  const handleConnect = useCallback(
    (connectorId: string) => {
      const connector = connectors.find((c) => c.id === connectorId);
      if (connector) {
        connect({ connector, chainId: BASE_CHAIN_ID });
        setShowConnectors(false);
      }
    },
    [connectors, connect]
  );

  const handlePay = useCallback(async () => {
    if (balance < priceUsdc) {
      setErrorMessage(`Insufficient balance. You need ${priceUsdc} USDC.`);
      setStep('error');
      return;
    }

    // Send full amount directly to the author
    await initiatePayment(recipientAddress, priceUsdc);
  }, [balance, priceUsdc, recipientAddress, initiatePayment]);

  const handleRetry = useCallback(() => {
    reset();
    setErrorMessage(null);
    refetch();
  }, [reset, refetch]);

  const canAfford = balance >= priceUsdc;

  return (
    <div className="space-y-4">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {['connect', 'pay', 'verify'].map((s, i) => {
          const isActive =
            (s === 'connect' &&
              (step === 'connect' || step === 'wrong-chain')) ||
            (s === 'pay' &&
              ['check-balance', 'ready', 'paying', 'confirming'].includes(
                step
              )) ||
            (s === 'verify' && ['submitting', 'success'].includes(step));
          const isComplete =
            (s === 'connect' && isConnected && !isWrongChain) ||
            (s === 'pay' && ['submitting', 'success'].includes(step)) ||
            (s === 'verify' && step === 'success');

          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-0.5 ${
                    isComplete ? 'bg-claw-secondary' : 'bg-muted'
                  }`}
                />
              )}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete
                    ? 'bg-claw-secondary text-white'
                    : isActive
                      ? 'bg-[#0052FF] text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isComplete ? '✓' : i + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Step */}
      {step === 'connect' && (
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to continue
          </p>
          <div className="relative">
            <Button
              onClick={() => setShowConnectors(!showConnectors)}
              variant="outline"
              className="w-full border-[#0052FF]/30 hover:border-[#0052FF] hover:bg-[#0052FF]/5"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size={16} />
                  Connecting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-[#0052FF]">Ⓑ</span>
                  Connect Wallet
                </span>
              )}
            </Button>

            {showConnectors && (
              <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-lg border border-border bg-card shadow-lg z-50">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => handleConnect(connector.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left transition-colors"
                  >
                    <span className="font-medium text-sm">
                      {connector.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wrong Chain Step */}
      {step === 'wrong-chain' && (
        <div className="text-center space-y-4">
          <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-sm">
            Please switch to Base network in your wallet
          </div>
          <p className="text-sm text-muted-foreground">
            Your wallet is connected to a different network.
          </p>
        </div>
      )}

      {/* Check Balance Step */}
      {step === 'check-balance' && (
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">
            Checking your USDC balance...
          </p>
        </div>
      )}

      {/* Ready Step */}
      {step === 'ready' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">
                Your Balance
              </span>
              <span className="font-medium">${balance.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Price</span>
              <span className="font-medium" style={{ color: '#FF8533' }}>
                ${priceUsdc.toFixed(2)} USDC
              </span>
            </div>
          </div>

          {!canAfford && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              Insufficient balance. You need ${(priceUsdc - balance).toFixed(2)}{' '}
              more USDC.
            </div>
          )}

          <Button
            onClick={handlePay}
            className="w-full bg-[#0052FF] hover:bg-[#0052FF]/90 text-white"
            disabled={!canAfford}
          >
            Pay ${priceUsdc.toFixed(2)} USDC
          </Button>
        </div>
      )}

      {/* Paying Step */}
      {step === 'paying' && (
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">
            {paymentState.status === 'switching-chain'
              ? 'Please switch to Base network...'
              : paymentState.status === 'preparing'
                ? 'Preparing transaction...'
                : 'Please confirm in your wallet...'}
          </p>
        </div>
      )}

      {/* Confirming Step */}
      {step === 'confirming' && (
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">
            Confirming transaction on Base...
          </p>
          {paymentState.hash && (
            <a
              href={`https://basescan.org/tx/${paymentState.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#0052FF] hover:underline"
            >
              View on BaseScan →
            </a>
          )}
        </div>
      )}

      {/* Submitting Step */}
      {step === 'submitting' && (
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">
            Verifying payment and unlocking content...
          </p>
        </div>
      )}

      {/* Success Step */}
      {step === 'success' && (
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-claw-secondary/10 text-claw-secondary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <p className="font-medium">Payment successful!</p>
          <p className="text-sm text-muted-foreground">
            Content is now unlocked.
          </p>
        </div>
      )}

      {/* Error Step */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
            {errorMessage || 'An error occurred'}
          </div>
          <Button onClick={handleRetry} variant="outline" className="w-full">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="animate-spin mx-auto text-[#0052FF]"
      width={size}
      height={size}
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
  );
}
