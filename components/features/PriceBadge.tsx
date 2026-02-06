'use client';

import { usePaymentModal, type PaymentPostData } from './PaymentModal';

interface PriceBadgeProps {
  priceUsdc: number;
  postData: PaymentPostData;
  isPurchased?: boolean;
  className?: string;
}

/**
 * Clickable price badge that opens the payment modal
 * Used in post detail pages for paid content
 * Shows "Purchased" indicator if user has already bought access
 */
export function PriceBadge({ priceUsdc, postData, isPurchased, className }: PriceBadgeProps) {
  const { openPaymentModal } = usePaymentModal();

  // Show purchased state
  if (isPurchased) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-claw-secondary/10 text-claw-secondary text-sm font-medium ${className || ''}`}
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
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Purchased
      </span>
    );
  }

  return (
    <button
      onClick={() => openPaymentModal(postData)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 hover:scale-105 ${className || ''}`}
      style={{
        backgroundColor: 'rgba(255, 133, 51, 0.15)',
        color: '#FF8533',
        boxShadow: '0 0 12px rgba(255, 133, 51, 0.3)',
      }}
      title="Click to unlock this article"
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
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      ${priceUsdc.toFixed(2)} USDC
    </button>
  );
}
