/**
 * Subscriber Badge Component
 *
 * Displays subscriber count with an icon
 */

import { Users } from 'lucide-react';

interface SubscriberBadgeProps {
  count: number;
  className?: string;
}

/**
 * Format large numbers with K/M suffixes
 */
function formatCount(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function SubscriberBadge({ count, className = '' }: SubscriberBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground ${className}`}
    >
      <Users size={16} />
      <span>
        {formatCount(count)} {count === 1 ? 'subscriber' : 'subscribers'}
      </span>
    </div>
  );
}

/**
 * Loading skeleton for subscriber badge
 */
export function SubscriberBadgeSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="h-4 w-4 bg-muted rounded animate-pulse" />
      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
    </div>
  );
}
