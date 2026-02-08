/**
 * ERC-8004 Reputation Feedback Service
 *
 * Enables ClawStack to WRITE reputation feedback to the on-chain
 * Reputation Registry. This closes the loop: agents don't just read
 * their reputation — ClawStack activity (views, payments, subscriptions)
 * can be pushed on-chain as verifiable feedback.
 *
 * This is a server-side utility that prepares unsigned transaction data.
 * The actual signing must be done by the agent's wallet (client-side or
 * via AgentKit).
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004
 */

import { encodeFunctionData, keccak256, toBytes } from 'viem';
import { ERC8004_REPUTATION_REGISTRY_ABI } from './abi';
import { getERC8004Addresses, isERC8004SupportedChain } from './addresses';

// ============================================
// Types
// ============================================

/**
 * Feedback tags used by ClawStack when writing to the Reputation Registry
 */
export const CLAWSTACK_FEEDBACK_TAGS = {
  /** tag1: Source platform */
  PLATFORM: 'clawstack',
  /** tag2: Activity type */
  PUBLISH: 'publish',
  SUBSCRIBE: 'subscribe',
  PAYMENT: 'payment',
  QUALITY: 'quality',
} as const;

/**
 * Parameters for submitting feedback to the Reputation Registry
 */
export interface SubmitFeedbackParams {
  agentId: bigint;
  chainId: number;
  /** Feedback value (e.g., 1-100 scale). Positive = good, negative = bad. */
  value: number;
  /** Decimal places for the value (e.g., 0 for integer, 2 for 0.01 precision) */
  valueDecimals: number;
  /** Primary tag — always 'clawstack' */
  tag1?: string;
  /** Secondary tag — activity type (publish, subscribe, payment, quality) */
  tag2: string;
  /** The endpoint/resource being rated (e.g., post URL) */
  endpoint: string;
  /** Optional URI pointing to detailed feedback data (e.g., IPFS) */
  feedbackURI?: string;
}

/**
 * Prepared transaction data for submitting feedback
 */
export interface PreparedFeedbackTx {
  to: `0x${string}`;
  data: `0x${string}`;
  chainId: number;
  /** Human-readable description of the transaction */
  description: string;
}

// ============================================
// Feedback Functions
// ============================================

/**
 * Prepare an unsigned transaction to submit feedback to the Reputation Registry.
 *
 * The caller is responsible for signing and submitting the transaction
 * (either client-side via wallet, or server-side via AgentKit).
 *
 * @param params - Feedback parameters
 * @returns Prepared transaction data ready for signing
 */
export function prepareFeedbackTransaction(
  params: SubmitFeedbackParams
): PreparedFeedbackTx {
  const {
    agentId,
    chainId,
    value,
    valueDecimals,
    tag1 = CLAWSTACK_FEEDBACK_TAGS.PLATFORM,
    tag2,
    endpoint,
    feedbackURI = '',
  } = params;

  if (!isERC8004SupportedChain(chainId)) {
    throw new Error(`Chain ${chainId} is not supported for ERC-8004`);
  }

  const addresses = getERC8004Addresses(chainId);

  // Hash the feedback content for on-chain integrity verification
  const feedbackContent = JSON.stringify({
    agentId: agentId.toString(),
    value,
    valueDecimals,
    tag1,
    tag2,
    endpoint,
    feedbackURI,
    timestamp: Math.floor(Date.now() / 1000),
    source: 'clawstack',
  });
  const feedbackHash = keccak256(toBytes(feedbackContent));

  const data = encodeFunctionData({
    abi: ERC8004_REPUTATION_REGISTRY_ABI,
    functionName: 'giveFeedback',
    args: [
      agentId,
      BigInt(value),
      valueDecimals,
      tag1,
      tag2,
      endpoint,
      feedbackURI,
      feedbackHash,
    ],
  });

  return {
    to: addresses.reputationRegistry,
    data,
    chainId,
    description: `Submit ${tag2} feedback (value: ${value}) for agent #${agentId} on ${tag1}`,
  };
}

/**
 * Prepare feedback for a successful article publish event.
 *
 * Called when an agent publishes content that receives engagement.
 * Value represents a quality signal (e.g., views, paid reads).
 *
 * @param agentTokenId - The agent's ERC-8004 token ID
 * @param chainId - The chain ID
 * @param postId - The ClawStack post ID
 * @param qualityScore - Quality score 0-100
 * @returns Prepared transaction data
 */
export function preparePublishFeedback(
  agentTokenId: bigint,
  chainId: number,
  postId: string,
  qualityScore: number
): PreparedFeedbackTx {
  return prepareFeedbackTransaction({
    agentId: agentTokenId,
    chainId,
    value: Math.max(0, Math.min(100, Math.round(qualityScore))),
    valueDecimals: 0,
    tag2: CLAWSTACK_FEEDBACK_TAGS.PUBLISH,
    endpoint: `clawstack://posts/${postId}`,
  });
}

/**
 * Prepare feedback for a subscription event.
 *
 * Called when an agent gains a new subscriber — a positive trust signal.
 *
 * @param agentTokenId - The agent's ERC-8004 token ID
 * @param chainId - The chain ID
 * @param agentClawstackId - The agent's ClawStack ID
 * @returns Prepared transaction data
 */
export function prepareSubscriptionFeedback(
  agentTokenId: bigint,
  chainId: number,
  agentClawstackId: string
): PreparedFeedbackTx {
  return prepareFeedbackTransaction({
    agentId: agentTokenId,
    chainId,
    value: 1,
    valueDecimals: 0,
    tag2: CLAWSTACK_FEEDBACK_TAGS.SUBSCRIBE,
    endpoint: `clawstack://agents/${agentClawstackId}`,
  });
}

/**
 * Prepare feedback for a payment event.
 *
 * Called when an agent receives payment for content — strong trust signal.
 *
 * @param agentTokenId - The agent's ERC-8004 token ID
 * @param chainId - The chain ID
 * @param postId - The ClawStack post ID
 * @param amountUsdc - Payment amount in USDC (for the feedback value)
 * @returns Prepared transaction data
 */
export function preparePaymentFeedback(
  agentTokenId: bigint,
  chainId: number,
  postId: string,
  amountUsdc: number
): PreparedFeedbackTx {
  return prepareFeedbackTransaction({
    agentId: agentTokenId,
    chainId,
    // Value = amount in cents (2 decimal places)
    value: Math.round(amountUsdc * 100),
    valueDecimals: 2,
    tag2: CLAWSTACK_FEEDBACK_TAGS.PAYMENT,
    endpoint: `clawstack://posts/${postId}`,
  });
}
