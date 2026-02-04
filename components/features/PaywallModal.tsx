'use client';

import { useState, useCallback, useEffect } from 'react';
import { SolanaPaymentFlow } from './SolanaPaymentFlow';
import { EVMPaymentFlow } from './EVMPaymentFlow';

interface PaywallModalProps {
  postId: string;
  title: string;
  priceUsdc: number;
  previewContent: string;
  authorWalletSolana: string | null;
  authorWalletBase: string | null;
}

type PaymentChain = 'solana' | 'base' | null;

const CHAIN_PREFERENCE_KEY = 'clawstack_preferred_chain';

// Chain metadata with display info
const CHAIN_CONFIG = {
  solana: {
    id: 'solana' as const,
    name: 'Solana',
    icon: '◎',
    color: '#9945FF',
    bgColor: 'bg-[#9945FF]/10',
    borderColor: 'border-[#9945FF]',
    hoverBg: 'hover:bg-[#9945FF]/5',
    hoverBorder: 'hover:border-[#9945FF]/50',
    networkLabel: 'on Solana',
  },
  base: {
    id: 'base' as const,
    name: 'Base',
    icon: 'Ⓑ',
    color: '#0052FF',
    bgColor: 'bg-[#0052FF]/10',
    borderColor: 'border-[#0052FF]',
    hoverBg: 'hover:bg-[#0052FF]/5',
    hoverBorder: 'hover:border-[#0052FF]/50',
    networkLabel: 'on Base',
  },
};

/**
 * Get the user's preferred payment chain from localStorage
 */
function getPreferredChain(): PaymentChain {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(CHAIN_PREFERENCE_KEY);
  if (stored === 'solana' || stored === 'base') {
    return stored;
  }
  return null;
}

/**
 * Save the user's preferred payment chain to localStorage
 */
function setPreferredChain(chain: PaymentChain): void {
  if (typeof window === 'undefined' || !chain) return;
  localStorage.setItem(CHAIN_PREFERENCE_KEY, chain);
}

export function PaywallModal({
  postId,
  title,
  priceUsdc,
  previewContent,
  authorWalletSolana,
  authorWalletBase,
}: PaywallModalProps) {
  const [selectedChain, setSelectedChain] = useState<PaymentChain>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [rememberPreference, setRememberPreference] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  const allChains = [
    { ...CHAIN_CONFIG.solana, wallet: authorWalletSolana },
    { ...CHAIN_CONFIG.base, wallet: authorWalletBase },
  ];

  const availableChains = allChains.filter((chain) => chain.wallet !== null);

  // 5.4.5: Load saved chain preference on mount
  useEffect(() => {
    const preferred = getPreferredChain();
    // Only auto-select if the preferred chain is available for this author
    if (preferred) {
      const isAvailable = availableChains.some((c) => c.id === preferred);
      if (isAvailable) {
        setSelectedChain(preferred);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChainSelect = useCallback(
    (chainId: 'solana' | 'base') => {
      setSelectedChain(chainId);
      setPaymentError(null);
      // 5.4.5: Save preference if user opted in
      if (rememberPreference) {
        setPreferredChain(chainId);
      }
    },
    [rememberPreference]
  );

  const handlePaymentSuccess = useCallback(() => {
    // 5.4.6: Trigger success animation
    setIsAnimating(true);
    setPaymentSuccess(true);
    // Delay reload to show animation
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }, []);

  // 5.4.4: Graceful error handling with UI feedback
  const handlePaymentError = useCallback((error: string) => {
    console.error('Payment error:', error);
    setPaymentError(error);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedChain(null);
    setPaymentError(null);
  }, []);

  const handleDismissError = useCallback(() => {
    setPaymentError(null);
  }, []);

  // Get the selected chain config for display
  const selectedChainConfig = selectedChain
    ? CHAIN_CONFIG[selectedChain]
    : null;

  // 5.4.6: Success state with animation
  if (paymentSuccess) {
    return (
      <div className="relative">
        <div className="relative overflow-hidden rounded-xl">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-lg text-muted-foreground">{previewContent}</p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/50 flex items-end justify-center pb-8">
            <div className="w-full max-w-md">
              <div
                className={`bg-card border border-border rounded-xl p-6 shadow-lg text-center transition-all duration-500 ${
                  isAnimating ? 'animate-success-bounce' : ''
                }`}
              >
                {/* Animated checkmark with ring effect */}
                <div className="relative inline-flex items-center justify-center mb-4">
                  <div
                    className={`absolute w-20 h-20 rounded-full bg-claw-secondary/20 ${
                      isAnimating ? 'animate-ping-slow' : ''
                    }`}
                  />
                  <div
                    className={`relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-claw-secondary text-white transition-transform duration-300 ${
                      isAnimating ? 'scale-110' : ''
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={isAnimating ? 'animate-draw-check' : ''}
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                </div>
                <h3
                  className={`text-xl font-bold mb-2 transition-opacity duration-500 ${
                    isAnimating ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  Payment Successful!
                </h3>
                <p
                  className={`text-muted-foreground text-sm transition-opacity duration-700 delay-200 ${
                    isAnimating ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  Unlocking content...
                </p>
                {/* Loading indicator */}
                <div className="mt-4 flex justify-center">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 rounded-full bg-claw-secondary animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-claw-secondary animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-claw-secondary animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Blurred Preview */}
      <div className="relative overflow-hidden rounded-xl">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-lg text-muted-foreground">{previewContent}</p>
        </div>

        {/* Blur Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/50 flex items-end justify-center pb-8">
          <div className="w-full max-w-md">
            {/* Paywall Card */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
              {/* Header - always show price with chain context (5.4.2) */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-claw-primary/10 mb-4">
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
                    className="text-claw-primary"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Premium Content</h3>
                <p className="text-muted-foreground text-sm">
                  Unlock &ldquo;{title}&rdquo; for just
                </p>
                <div className="mt-2">
                  <p className="text-3xl font-bold text-claw-secondary">
                    ${priceUsdc.toFixed(2)}{' '}
                    <span className="text-lg font-normal">USDC</span>
                  </p>
                  {/* 5.4.2: Show chain context when selected */}
                  {selectedChainConfig && (
                    <span
                      className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${selectedChainConfig.color}15`,
                        color: selectedChainConfig.color,
                      }}
                    >
                      <span>{selectedChainConfig.icon}</span>
                      {selectedChainConfig.networkLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* 5.4.4: Error display */}
              {paymentError && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-destructive mt-0.5 flex-shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm text-destructive font-medium">
                        Payment failed
                      </p>
                      <p className="text-xs text-destructive/80 mt-0.5">
                        {paymentError}
                      </p>
                    </div>
                    <button
                      onClick={handleDismissError}
                      className="text-destructive/60 hover:text-destructive"
                    >
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
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Chain Selection or Payment Flow */}
              {availableChains.length > 0 ? (
                selectedChain === null ? (
                  // 5.4.1: Enhanced Chain Selection
                  <div className="space-y-4 mb-6">
                    <p className="text-sm font-medium text-center">
                      Choose your payment network:
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {availableChains.map((chain) => {
                        const config = CHAIN_CONFIG[chain.id];
                        return (
                          <button
                            key={chain.id}
                            onClick={() => handleChainSelect(chain.id)}
                            className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all duration-200 ${config.hoverBorder} ${config.hoverBg} border-border group`}
                          >
                            {/* Chain icon with background */}
                            <div
                              className={`flex items-center justify-center w-10 h-10 rounded-full ${config.bgColor} transition-transform group-hover:scale-110`}
                            >
                              <span
                                className="text-xl"
                                style={{ color: config.color }}
                              >
                                {config.icon}
                              </span>
                            </div>
                            <span className="font-medium">{config.name}</span>
                            {/* USDC indicator */}
                            <span className="text-xs text-muted-foreground">
                              Pay with USDC
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {/* 5.4.5: Remember preference checkbox */}
                    <label className="flex items-center justify-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberPreference}
                        onChange={(e) =>
                          setRememberPreference(e.target.checked)
                        }
                        className="w-3.5 h-3.5 rounded border-border text-claw-primary focus:ring-claw-primary/20"
                      />
                      Remember my preference
                    </label>
                  </div>
                ) : selectedChain === 'solana' && authorWalletSolana ? (
                  // Solana Payment Flow
                  <div>
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                      Back
                    </button>
                    <SolanaPaymentFlow
                      postId={postId}
                      priceUsdc={priceUsdc}
                      recipientAddress={authorWalletSolana}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </div>
                ) : selectedChain === 'base' && authorWalletBase ? (
                  // Base/EVM Payment Flow
                  <div>
                    <button
                      onClick={handleBack}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                      Back
                    </button>
                    <EVMPaymentFlow
                      postId={postId}
                      priceUsdc={priceUsdc}
                      recipientAddress={authorWalletBase}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </div>
                ) : null
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    Author has not configured payment wallets yet.
                  </p>
                </div>
              )}

              {/* Trust Indicators */}
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    Secure
                  </span>
                  <span className="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    Instant
                  </span>
                  <span className="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    24h Access
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
