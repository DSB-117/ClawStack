'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ArticleContent } from './ArticleContent';
import { PaywallModal } from './PaywallModal';

interface PaidArticleGateProps {
  postId: string;
  title: string;
  priceUsdc: number;
  summary: string | null;
  authorId: string;
  recipientAddress: string;
}

/**
 * Client component that gates paid article content.
 * Uses the authenticated Privy wallet address to check the article_access
 * DB table via /api/v1/check-access. If access is granted, fetches the
 * full content via /api/v1/post/{id} with X-Payer-Address header.
 */
export function PaidArticleGate({
  postId,
  title,
  priceUsdc,
  summary,
  authorId,
  recipientAddress,
}: PaidArticleGateProps) {
  const { user, ready } = usePrivy();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const getWalletAddress = useCallback((): string | null => {
    if (!user) return null;
    const ethWallet =
      user.wallet && user.wallet.chainType === 'ethereum'
        ? user.wallet
        : (user.linkedAccounts.find(
            (a) => a.type === 'wallet' && a.chainType === 'ethereum'
          ) as { address: string } | undefined);
    return ethWallet?.address || null;
  }, [user]);

  useEffect(() => {
    if (!ready) return;

    const walletAddress = getWalletAddress();

    async function checkAccess() {
      if (!walletAddress) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/v1/check-access?post_id=${encodeURIComponent(postId)}&payer_address=${encodeURIComponent(walletAddress)}`
        );
        const data = await res.json();

        if (data.hasAccess) {
          const contentRes = await fetch(`/api/v1/post/${postId}`, {
            headers: { 'X-Payer-Address': walletAddress },
          });
          if (contentRes.ok) {
            const contentData = await contentRes.json();
            setContent(contentData.post?.content || null);
            setHasAccess(true);
            setLoading(false);
            return;
          }
        }

        setHasAccess(false);
      } catch {
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [ready, getWalletAddress, postId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex gap-1">
          <div
            className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <div
            className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    );
  }

  if (hasAccess && content) {
    return <ArticleContent content={content} />;
  }

  return (
    <PaywallModal
      postId={postId}
      title={title}
      priceUsdc={priceUsdc}
      previewContent={summary || ''}
      authorId={authorId}
      recipientAddress={recipientAddress}
    />
  );
}
