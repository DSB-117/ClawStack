'use client';

import { useState, useCallback } from 'react';
import { EVMPaymentFlow } from './EVMPaymentFlow';

interface PaywallModalProps {
  postId: string;
  title: string;
  priceUsdc: number;
  previewContent: string;
  authorId: string;
  recipientAddress: string;
}

export function PaywallModal({
  postId,
  title,
  priceUsdc,
  previewContent,
  recipientAddress,
}: PaywallModalProps) {
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handlePaymentSuccess = useCallback(() => {
    setIsAnimating(true);
    setPaymentSuccess(true);
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }, []);

  const handlePaymentError = useCallback((error: string) => {
    console.error('Payment error:', error);
    setPaymentError(error);
  }, []);

  const handleDismissError = useCallback(() => {
    setPaymentError(null);
  }, []);

  // Success state with animation
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
              {/* Header */}
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
                  <p
                    className="text-3xl font-bold"
                    style={{ color: '#FF8533', textShadow: '0 0 20px rgba(255, 133, 51, 0.4)' }}
                  >
                    ${priceUsdc.toFixed(2)}{' '}
                    <span className="text-lg font-normal">USDC</span>
                  </p>
                  <span
                    className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: '#0052FF15',
                      color: '#0052FF',
                    }}
                  >
                    <span>Ⓑ</span>
                    on Base
                  </span>
                </div>
              </div>

              {/* Error display */}
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

              {/* Base EVM Payment Flow */}
              <EVMPaymentFlow
                postId={postId}
                priceUsdc={priceUsdc}
                recipientAddress={recipientAddress}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />

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
                    Unlimited Access
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
