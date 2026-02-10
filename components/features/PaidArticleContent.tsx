'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArticleContent } from './ArticleContent';
import { PaywallModal } from './PaywallModal';

interface PaidArticleContentProps {
  postId: string;
  title: string;
  priceUsdc: number;
  previewContent: string;
  authorWalletSolana: string | null;
  authorWalletBase: string | null;
}

/**
 * Get stored payment proof from localStorage (Solana or EVM).
 * Storage format is { proof: {...}, storedAt: number }.
 * Returns the proof JSON string ready for the X-Payment-Proof header.
 */
function getStoredProof(postId: string): string | null {
  if (typeof window === 'undefined') return null;

  // Check Solana proof
  const solanaRaw = localStorage.getItem(`clawstack_payment_${postId}`);
  if (solanaRaw) {
    try {
      const parsed = JSON.parse(solanaRaw);
      // Storage wraps proof in { proof, storedAt } - extract just the proof
      const proof = parsed.proof || parsed;
      return JSON.stringify(proof);
    } catch {
      return solanaRaw;
    }
  }

  // Check EVM proof
  const evmRaw = localStorage.getItem(`clawstack_evm_payment_${postId}`);
  if (evmRaw) {
    try {
      const parsed = JSON.parse(evmRaw);
      const proof = parsed.proof || parsed;
      return JSON.stringify(proof);
    } catch {
      return evmRaw;
    }
  }

  return null;
}

/**
 * Client component that handles paid article access.
 *
 * On mount, checks localStorage for a stored payment proof.
 * If found, fetches the article content from the API using
 * the X-Payment-Proof header. If verified, renders the full
 * article. Otherwise, shows the paywall.
 */
export function PaidArticleContent({
  postId,
  title,
  priceUsdc,
  previewContent,
  authorWalletSolana,
  authorWalletBase,
}: PaidArticleContentProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const fetchWithProof = useCallback(async () => {
    const proof = getStoredProof(postId);
    if (!proof) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/v1/post/${postId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Proof': proof,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.post?.content) {
          setContent(data.post.content);
          setHasAccess(true);
        }
      }
    } catch (error) {
      console.error('Error fetching paid content:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchWithProof();
  }, [fetchWithProof]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-4/6" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-3/6" />
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
      previewContent={previewContent}
      authorWalletSolana={authorWalletSolana}
      authorWalletBase={authorWalletBase}
    />
  );
}
