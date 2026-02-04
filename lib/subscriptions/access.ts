/**
 * Subscription Access Control Utilities
 *
 * Helpers for checking subscription access and building payment options.
 *
 * @see claude/operations/tasks.md Tasks 4.3.1, 4.3.3, 4.3.6
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import { PaymentOption, PaymentChain } from '@/lib/x402/types';
import { X402_CONFIG, getPaymentValidUntil } from '@/lib/x402';

// ============================================================================
// Constants
// ============================================================================

/** 30 days in milliseconds */
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

/**
 * Subscription record with author pricing info
 */
export interface SubscriptionWithActive {
  id: string;
  subscriber_id: string;
  author_id: string;
  payment_type: 'per_view' | 'monthly';
  status: 'active' | 'paused' | 'cancelled';
  current_period_end: string | null;
  author?: {
    subscription_price_usdc: number | null;
    wallet_solana: string | null;
    wallet_base: string | null;
  };
}

/**
 * Result of subscription access check
 */
export interface SubscriptionAccessResult {
  /** Whether the requester has valid access */
  hasAccess: boolean;
  /** The subscription record if found */
  subscription: SubscriptionWithActive | null;
  /** Whether subscription is expired (needs renewal) */
  isExpired: boolean;
  /** Subscription price for renewal (if applicable) */
  renewalPriceUsdc: number | null;
}

// ============================================================================
// 4.3.1 & 4.3.6: Check Subscription Access
// ============================================================================

/**
 * Check if a subscriber has active access to an author's content.
 *
 * @param subscriberId - The agent ID of the requester
 * @param authorId - The author ID whose content is being accessed
 * @returns Access check result with subscription details
 */
export async function checkSubscriptionAccess(
  subscriberId: string,
  authorId: string
): Promise<SubscriptionAccessResult> {
  // Query subscription with author's pricing
  const { data: subscription, error } = await supabaseAdmin
    .from('subscriptions')
    .select(`
      id,
      subscriber_id,
      author_id,
      payment_type,
      status,
      current_period_end,
      author:agents!subscriptions_author_id_fkey(
        subscription_price_usdc,
        wallet_solana,
        wallet_base
      )
    `)
    .eq('subscriber_id', subscriberId)
    .eq('author_id', authorId)
    .eq('status', 'active')
    .single();

  if (error || !subscription) {
    return {
      hasAccess: false,
      subscription: null,
      isExpired: false,
      renewalPriceUsdc: null,
    };
  }

  const sub = subscription as unknown as SubscriptionWithActive;

  // Per-view subscriptions don't grant content access
  if (sub.payment_type === 'per_view') {
    return {
      hasAccess: false,
      subscription: sub,
      isExpired: false,
      renewalPriceUsdc: null,
    };
  }

  // Monthly subscription - check expiration
  const now = new Date();
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end)
    : null;

  // If no period end is set or period has expired
  if (!periodEnd || periodEnd <= now) {
    return {
      hasAccess: false,
      subscription: sub,
      isExpired: true,
      renewalPriceUsdc: sub.author?.subscription_price_usdc ?? null,
    };
  }

  // Active monthly subscription with valid period
  return {
    hasAccess: true,
    subscription: sub,
    isExpired: false,
    renewalPriceUsdc: sub.author?.subscription_price_usdc ?? null,
  };
}

// ============================================================================
// 4.3.3: Subscription Payment Options
// ============================================================================

/**
 * Generate payment memo for subscription payments.
 * Format: clawstack:sub:{subscriptionId}:{timestamp}
 */
export function generateSubscriptionMemo(subscriptionId: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return `${X402_CONFIG.MEMO_PREFIX}:sub:${subscriptionId}:${timestamp}`;
}

/**
 * Generate payment reference for subscription payments (EVM).
 * Format: 0xclawstack_sub_{subscriptionId}_{timestamp}
 */
export function generateSubscriptionReference(subscriptionId: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  // Create a hex-like reference for EVM chains
  return `0xclawstack_sub_${subscriptionId.slice(0, 8)}_${timestamp}`;
}

/**
 * Build Solana payment option for subscription.
 */
export function buildSubscriptionSolanaPaymentOption(
  subscriptionId: string,
  priceUsdc: number
): PaymentOption {
  return {
    chain: 'solana',
    chain_id: process.env.SOLANA_NETWORK || 'mainnet-beta',
    recipient: process.env.CLAWSTACK_SOLANA_TREASURY || 'CStkPay111111111111111111111111111111111111',
    token_mint: process.env.USDC_MINT_SOLANA || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    token_symbol: 'USDC',
    decimals: 6,
    memo: generateSubscriptionMemo(subscriptionId),
  };
}

/**
 * Build Base payment option for subscription.
 */
export function buildSubscriptionBasePaymentOption(
  subscriptionId: string,
  priceUsdc: number
): PaymentOption {
  return {
    chain: 'base',
    chain_id: process.env.BASE_CHAIN_ID || '8453',
    recipient: process.env.CLAWSTACK_BASE_TREASURY || '0x0000000000000000000000000000000000000000',
    token_contract: process.env.USDC_CONTRACT_BASE || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    token_symbol: 'USDC',
    decimals: 6,
    reference: generateSubscriptionReference(subscriptionId),
  };
}

/**
 * Build all payment options for subscription renewal.
 *
 * @param subscriptionId - The subscription ID
 * @param priceUsdc - Monthly price in USDC
 * @param chains - Chains to include (default: both)
 * @returns Array of payment options
 */
export function buildSubscriptionPaymentOptions(
  subscriptionId: string,
  priceUsdc: number,
  chains: PaymentChain[] = ['solana', 'base']
): PaymentOption[] {
  const options: PaymentOption[] = [];

  if (chains.includes('solana')) {
    options.push(buildSubscriptionSolanaPaymentOption(subscriptionId, priceUsdc));
  }

  if (chains.includes('base')) {
    options.push(buildSubscriptionBasePaymentOption(subscriptionId, priceUsdc));
  }

  return options;
}

// ============================================================================
// 4.3.5: Subscription Activation/Renewal
// ============================================================================

/**
 * Activate or renew a subscription after successful payment.
 * Extends the period by 30 days from current end or now (if expired).
 *
 * @param subscriptionId - The subscription to activate/renew
 * @returns The new period end date
 */
export async function activateOrRenewSubscription(
  subscriptionId: string
): Promise<{ success: boolean; newPeriodEnd: string | null; error?: string }> {
  // Get current subscription state
  const { data: subscription, error: fetchError } = await supabaseAdmin
    .from('subscriptions')
    .select('id, status, current_period_end, author_id, subscriber_id, payment_type')
    .eq('id', subscriptionId)
    .single();

  if (fetchError || !subscription) {
    return {
      success: false,
      newPeriodEnd: null,
      error: 'Subscription not found',
    };
  }

  const subData = subscription as any;
  const now = new Date();
  const currentEnd = subData.current_period_end
    ? new Date(subData.current_period_end)
    : new Date(0);

  // If active and not expired, add 30 days to current end
  // If expired or no end date, start fresh from now
  const newEnd =
    currentEnd > now
      ? new Date(currentEnd.getTime() + THIRTY_DAYS_MS)
      : new Date(now.getTime() + THIRTY_DAYS_MS);

  const newPeriodEnd = newEnd.toISOString();

  // Update subscription
  const { error: updateError } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_end: newPeriodEnd,
    })
    .eq('id', subscriptionId);

  if (updateError) {
    console.error('Failed to activate subscription:', updateError);
    return {
      success: false,
      newPeriodEnd: null,
      error: 'Failed to update subscription',
    };
  }

  // Notify author via webhook (fire and forget)
  // We use require('@/lib/webhooks/subscription') dynamically or import at top if possible
  // To avoid circular deps, let's dynamic import or just import at top if clean.
  // We'll trust module resolution.
  try {
    const { notifySubscriptionEvent } = await import('@/lib/webhooks/subscription');
    notifySubscriptionEvent(
      subData.author_id,
      subData.subscriber_id,
      subData.payment_type as 'monthly' | 'per_view'
    );
  } catch (err) {
    console.warn('Failed to trigger subscription webhook:', err);
  }

  return {
    success: true,
    newPeriodEnd,
  };
}

// ============================================================================
// Subscription Expired Response Builder
// ============================================================================

/**
 * Build 402 response for expired subscription.
 */
export interface SubscriptionExpiredResponse {
  error: 'subscription_expired';
  subscription_id: string;
  price_usdc: string;
  valid_until: string;
  payment_options: PaymentOption[];
  message: string;
}

export function buildSubscriptionExpiredResponse(
  subscriptionId: string,
  priceUsdc: number
): SubscriptionExpiredResponse {
  return {
    error: 'subscription_expired',
    subscription_id: subscriptionId,
    price_usdc: priceUsdc.toFixed(2),
    valid_until: getPaymentValidUntil(),
    payment_options: buildSubscriptionPaymentOptions(subscriptionId, priceUsdc),
    message: `Your monthly subscription has expired. Renew for $${priceUsdc.toFixed(2)}/month to continue accessing premium content.`,
  };
}
