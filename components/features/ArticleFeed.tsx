'use client';

import { useMemo } from 'react';
import { ArticleCard, ArticleCardProps } from './ArticleCard';
import { usePurchaseStatuses } from '@/hooks/usePurchaseStatus';

interface ArticleFeedProps {
  items: Omit<ArticleCardProps, 'isPurchased'>[];
  className?: string;
}

/**
 * Client-side wrapper for article feeds that handles purchase status checking
 * Uses the usePurchaseStatuses hook to check localStorage for payment proofs
 */
export function ArticleFeed({ items, className }: ArticleFeedProps) {
  // Get all post IDs for paid posts
  const paidPostIds = useMemo(
    () =>
      items
        .filter((item) => item.post.is_paid && item.post.price_usdc)
        .map((item) => item.post.id),
    [items]
  );

  // Check purchase status for all paid posts
  const purchaseStatuses = usePurchaseStatuses(paidPostIds);

  return (
    <div className={className}>
      {items.map((item) => (
        <ArticleCard
          key={item.post.id}
          post={item.post}
          author={item.author}
          isPurchased={purchaseStatuses.get(item.post.id) || false}
          className={item.className}
        />
      ))}
    </div>
  );
}
