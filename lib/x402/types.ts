/**
 * x402 Protocol Type Definitions
 *
 * This file contains all TypeScript interfaces for the x402 HTTP 402
 * Payment Required protocol implementation.
 *
 * @see claude/knowledge/prd.md Section 2.2 (x402 Payment Flow)
 * @see claude/operations/tasks.md Task 2.3.1
 */

/**
 * Supported blockchain networks for payments.
 */
export type PaymentChain = 'solana' | 'base';

/**
 * Payment option structure returned in 402 responses.
 * Contains all information needed for a client to construct a payment transaction.
 */
export interface PaymentOption {
  /** Blockchain network identifier */
  chain: PaymentChain;

  /** Chain-specific network ID (e.g., 'mainnet-beta' for Solana, '8453' for Base) */
  chain_id: string;

  /** Recipient wallet/contract address */
  recipient: string;

  /** Token mint address (Solana SPL tokens) */
  token_mint?: string;

  /** Token contract address (EVM ERC-20 tokens) */
  token_contract?: string;

  /** Token symbol for display (e.g., 'USDC') */
  token_symbol: string;

  /** Token decimal places (6 for USDC) */
  decimals: number;

  /** Payment memo/reference (Solana - included in transaction) */
  memo?: string;

  /** Payment reference (EVM - used for tracking) */
  reference?: string;
}

/**
 * 402 Payment Required response body structure.
 * Follows x402 protocol specification.
 */
export interface PaymentRequiredResponse {
  /** Error type identifier */
  error: 'payment_required';

  /** Resource identifier (post ID) */
  resource_id: string;

  /** Price in USDC as string (e.g., "0.25") */
  price_usdc: string;

  /** ISO 8601 timestamp when payment offer expires */
  valid_until: string;

  /** Array of payment options (one per supported chain) */
  payment_options: PaymentOption[];

  /** Preview of content for display before payment */
  preview: {
    title: string;
    summary: string | null;
    author: {
      id: string;
      display_name: string;
      avatar_url: string | null;
    };
  };

  /** Optional facilitator endpoint for payment verification */
  facilitator_endpoint?: string;
}

/**
 * Payment proof structure sent in X-Payment-Proof header.
 * Client sends this after completing payment to access content.
 */
export interface PaymentProof {
  /** Blockchain network where payment was made */
  chain: PaymentChain;

  /** On-chain transaction signature/hash */
  transaction_signature: string;

  /** Payer's wallet address */
  payer_address: string;

  /** Unix timestamp when payment was made */
  timestamp: number;
}

/**
 * Result of payment verification.
 */
export interface VerificationResult {
  /** Whether payment verification succeeded */
  success: boolean;

  /** Error message if verification failed */
  error?: string;

  /** Error code for structured error handling */
  error_code?: string;

  /** Verified payment details (if successful) */
  payment?: {
    /** Transaction signature */
    signature: string;

    /** Payer wallet address */
    payer: string;

    /** Recipient wallet address */
    recipient: string;

    /** Amount in raw units (6 decimals for USDC) */
    amount_raw: bigint;

    /** Amount in USDC (human-readable) */
    amount_usdc: string;

    /** Network where payment was made */
    network: PaymentChain;

    /** Chain ID */
    chain_id: string;
  };
}

/**
 * Post data needed for payment verification and response.
 */
export interface PostForPayment {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  is_paid: boolean;
  price_usdc: number | null;
  paid_view_count: number;
  author_id: string;
  author: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    wallet_solana: string | null;
    wallet_base: string | null;
  };
}

/**
 * Configuration constants for x402 protocol.
 */
export const X402_CONFIG = {
  /** Protocol version header value */
  PROTOCOL_VERSION: 'x402-v1',

  /** Payment validity window in seconds (5 minutes) */
  PAYMENT_VALIDITY_SECONDS: 300,

  /** Memo prefix for ClawStack payments */
  MEMO_PREFIX: 'clawstack',

  /** HTTP headers for 402 responses */
  HEADERS: {
    VERSION: 'X-Payment-Version',
    OPTIONS: 'X-Payment-Options',
    PROOF: 'X-Payment-Proof',
  },
} as const;
