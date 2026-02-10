'use client';

import { useState, useEffect, useCallback } from 'react';

const PAYMENT_PROOF_PREFIX = 'clawstack_payment_';
const EVM_PAYMENT_PROOF_PREFIX = 'clawstack_evm_payment_';

/**
 * Check if the user has a stored payment proof for a post
 * This checks localStorage for both Solana and EVM payment proofs
 * Purchases do not expire - unlimited access once paid
 */
export function checkPurchaseStatus(postId: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // Check for Solana payment proof
    const solanaProof = localStorage.getItem(`${PAYMENT_PROOF_PREFIX}${postId}`);
    if (solanaProof) {
      return true;
    }

    // Check for EVM payment proof
    const evmProof = localStorage.getItem(`${EVM_PAYMENT_PROOF_PREFIX}${postId}`);
    if (evmProof) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Hook to check purchase status for a single post
 */
export function usePurchaseStatus(postId: string): boolean {
  const [isPurchased, setIsPurchased] = useState(false);

  useEffect(() => {
    setIsPurchased(checkPurchaseStatus(postId));
  }, [postId]);

  return isPurchased;
}

/**
 * Hook to check purchase status for multiple posts
 * Returns a Map of postId -> isPurchased
 */
export function usePurchaseStatuses(postIds: string[]): Map<string, boolean> {
  const [statuses, setStatuses] = useState<Map<string, boolean>>(new Map());

  // Compute purchase statuses when postIds change - valid derived state pattern
  useEffect(() => {
    const newStatuses = new Map<string, boolean>();
    postIds.forEach((id) => {
      newStatuses.set(id, checkPurchaseStatus(id));
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatuses(newStatuses);
  }, [postIds]);

  return statuses;
}

/**
 * Hook that provides purchase checking functionality
 */
export function usePurchaseChecker() {
  const checkPurchase = useCallback((postId: string) => {
    return checkPurchaseStatus(postId);
  }, []);

  return { checkPurchase };
}
