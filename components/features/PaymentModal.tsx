'use client';

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from 'react';
import { EVMPaymentFlow } from './EVMPaymentFlow';
import { PrivyPaymentFlow } from './PrivyPaymentFlow';

// Payment post data interface
export interface PaymentPostData {
  postId: string;
  title: string;
  priceUsdc: number;
  previewContent: string;
  authorId: string;
  authorWalletBase: string | null;
}

// Context for managing payment modal state globally
interface PaymentModalContextType {
  isOpen: boolean;
  postData: PaymentPostData | null;
  openPaymentModal: (data: PaymentPostData) => void;
  closePaymentModal: () => void;
}

const PaymentModalContext = createContext<PaymentModalContextType | null>(null);

export function usePaymentModal() {
  const context = useContext(PaymentModalContext);
  if (!context) {
    throw new Error(
      'usePaymentModal must be used within a PaymentModalProvider'
    );
  }
  return context;
}

interface PaymentModalProviderProps {
  children: React.ReactNode;
}

export function PaymentModalProvider({ children }: PaymentModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [postData, setPostData] = useState<PaymentPostData | null>(null);

  const openPaymentModal = useCallback((data: PaymentPostData) => {
    setPostData(data);
    setIsOpen(true);
  }, []);

  const closePaymentModal = useCallback(() => {
    setIsOpen(false);
    // Delay clearing data to allow for close animation
    setTimeout(() => setPostData(null), 200);
  }, []);

  return (
    <PaymentModalContext.Provider
      value={{ isOpen, postData, openPaymentModal, closePaymentModal }}
    >
      {children}
      <PaymentModalDialog
        isOpen={isOpen}
        postData={postData}
        onClose={closePaymentModal}
      />
    </PaymentModalContext.Provider>
  );
}

type PaymentMethod = 'privy' | 'external' | null;

const BASE_CHAIN_CONFIG = {
  name: 'Base',
  icon: 'Ⓑ',
  color: '#0052FF',
  networkLabel: 'on Base',
};

interface PaymentModalDialogProps {
  isOpen: boolean;
  postData: PaymentPostData | null;
  onClose: () => void;
}

function PaymentModalDialog({
  isOpen,
  postData,
  onClose,
}: PaymentModalDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [splitAddress, setSplitAddress] = useState<string | null>(null);
  const [splitLoading, setSplitLoading] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !paymentSuccess) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, paymentSuccess]);

  // Fetch split address when modal opens
  useEffect(() => {
    if (!isOpen || !postData?.authorId) return;

    let cancelled = false;

    const fetchSplitAddress = async () => {
      setSplitLoading(true);
      try {
        const res = await fetch(`/api/v1/author-split/${postData.authorId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.split_address) {
            setSplitAddress(data.split_address);
          }
        }
        // If 404 or error, splitAddress stays null → treasury fallback is used
      } catch (err) {
        console.error('Failed to fetch split address:', err);
      } finally {
        if (!cancelled) {
          setSplitLoading(false);
        }
      }
    };

    fetchSplitAddress();

    return () => {
      cancelled = true;
    };
  }, [isOpen, postData?.authorId]);

  // Reset state when modal closes - valid cleanup pattern
  useEffect(() => {
    if (!isOpen) {
      setPaymentMethod(null);
      setPaymentSuccess(false);
      setPaymentError(null);
      setIsAnimating(false);
      setSplitAddress(null);
    }
  }, [isOpen]);

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

  const handleBack = useCallback(() => {
    setPaymentMethod(null);
    setPaymentError(null);
  }, []);

  const handlePaymentMethodSelect = useCallback(
    (method: 'privy' | 'external') => {
      setPaymentMethod(method);
      setPaymentError(null);
    },
    []
  );

  const handleDismissError = useCallback(() => {
    setPaymentError(null);
  }, []);

  if (!isOpen || !postData) return null;

  const { postId, title, priceUsdc } = postData;

  // Use split address if available, otherwise fall back to treasury
  const recipientAddress =
    splitAddress ||
    process.env.NEXT_PUBLIC_BASE_TREASURY_ADDRESS ||
    '0xF1F9448354F99fAe1D29A4c82DC839c16e72AfD5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !paymentSuccess && onClose()}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        {!paymentSuccess && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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
        )}

        {/* Success State */}
        {paymentSuccess ? (
          <div className="p-8 text-center">
            <div className="relative inline-flex items-center justify-center mb-4">
              <div
                className={`absolute w-20 h-20 rounded-full bg-claw-secondary/20 ${
                  isAnimating ? 'animate-ping' : ''
                }`}
                style={{ animationDuration: '1.5s' }}
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
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2">Payment Successful!</h3>
            <p className="text-muted-foreground text-sm">
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
        ) : (
          <div className="p-6">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-claw-primary/10 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
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
              <h3 className="text-xl font-bold mb-2">Unlock Premium Content</h3>
              <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                &ldquo;{title}&rdquo;
              </p>

              {/* Price Display */}
              <div className="mt-2">
                <p
                  className="text-3xl font-bold"
                  style={{
                    color: '#FF8533',
                    textShadow: '0 0 20px rgba(255, 133, 51, 0.4)',
                  }}
                >
                  ${priceUsdc.toFixed(2)}{' '}
                  <span className="text-lg font-normal">USDC</span>
                </p>
                <span
                  className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${BASE_CHAIN_CONFIG.color}15`,
                    color: BASE_CHAIN_CONFIG.color,
                  }}
                >
                  <span>{BASE_CHAIN_CONFIG.icon}</span>
                  {BASE_CHAIN_CONFIG.networkLabel}
                </span>
              </div>

              {/* Access Duration Badge */}
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm">
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
                  <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
                </svg>
                <span className="font-medium">Unlimited access</span>
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

            {/* Split address loading */}
            {splitLoading ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Setting up payment...
                </p>
              </div>
            ) : paymentMethod === null ? (
              // Payment Method Selection (skip chain selection - Base only)
              <div className="space-y-4">
                <p className="text-sm font-medium text-center">
                  How would you like to pay?
                </p>
                <div className="space-y-3">
                  {/* Use Account Funds (Privy) */}
                  <button
                    onClick={() => handlePaymentMethodSelect('privy')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-claw-primary/50 hover:bg-claw-primary/5 transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-claw-primary/10 group-hover:scale-110 transition-transform">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-claw-primary"
                      >
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">Use Account Funds</p>
                      <p className="text-xs text-muted-foreground">
                        Pay from your ClawStack wallet
                      </p>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground group-hover:text-claw-primary"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>

                  {/* Connect External Wallet */}
                  <button
                    onClick={() => handlePaymentMethodSelect('external')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-muted-foreground/50 hover:bg-muted/30 transition-all duration-200 group"
                  >
                    <div
                      className="flex items-center justify-center w-12 h-12 rounded-full transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: `${BASE_CHAIN_CONFIG.color}15`,
                      }}
                    >
                      <span
                        className="text-2xl"
                        style={{ color: BASE_CHAIN_CONFIG.color }}
                      >
                        {BASE_CHAIN_CONFIG.icon}
                      </span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">Connect Wallet</p>
                      <p className="text-xs text-muted-foreground">
                        Use Base wallet (MetaMask, Coinbase Wallet, etc.)
                      </p>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground group-hover:text-foreground"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : paymentMethod === 'privy' ? (
              // Privy Payment Flow
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
                <PrivyPaymentFlow
                  postId={postId}
                  priceUsdc={priceUsdc}
                  recipientAddress={recipientAddress}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </div>
            ) : paymentMethod === 'external' ? (
              // External EVM Wallet
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
                  recipientAddress={recipientAddress}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </div>
            ) : null}

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
        )}
      </div>
    </div>
  );
}
