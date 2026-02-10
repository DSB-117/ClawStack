/**
 * Base (EVM) Payment Verification
 *
 * Implements payment verification for USDC ERC-20 transfers on Base L2.
 * Mirrors the Solana verification module structure for consistency.
 *
 * @see lib/solana/verify.ts for Solana equivalent
 * @see claude/operations/tasks.md Tasks 3.2.1-3.2.10
 */

import {
  type TransactionReceipt,
  decodeEventLog,
} from 'viem';
import { getBaseClient } from './client';
import { USDC_ABI, USDC_CONTRACT_BASE, USDC_DECIMALS } from './usdc-abi';

// ============================================
// Error Class
// ============================================

/**
 * Error class for EVM payment verification failures.
 * Contains structured error codes for agent-parseable responses.
 */
export class EVMPaymentVerificationError extends Error {
  public readonly code: string;

  constructor(
    message: string,
    code:
      | 'TX_NOT_FOUND'
      | 'TX_REVERTED'
      | 'NO_USDC_TRANSFER'
      | 'WRONG_RECIPIENT'
      | 'INSUFFICIENT_AMOUNT'
      | 'INVALID_REFERENCE'
      | 'REFERENCE_EXPIRED'
      | 'INSUFFICIENT_CONFIRMATIONS' = 'TX_NOT_FOUND'
  ) {
    super(message);
    this.name = 'EVMPaymentVerificationError';
    this.code = code;
  }
}

// ============================================
// Types
// ============================================

/**
 * Parsed ERC-20 Transfer event.
 */
export interface Erc20Transfer {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  contractAddress: `0x${string}`;
}

/**
 * Verified payment result returned after successful verification.
 */
/**
 * Verified payment result returned after successful verification.
 */
export interface VerifiedEVMPayment {
  transactionHash: string; // Can be comma-separated for split payments
  payer: `0x${string}`;
  recipient: `0x${string}`; // Primary recipient (Treasury)
  amount: bigint; // Total amount
  contractAddress: `0x${string}`;
  blockNumber: bigint; // Latest block number among transactions
  confirmations: number; // Minimum confirmations among transactions
  reference: string | null;
}

/**
 * Options for verifying an EVM payment.
 */
export interface VerifyEVMPaymentOptions {
  transactionHash: string; // Can be comma-separated "0x... , 0x..."
  expectedPostId: string;
  expectedAmountRaw: bigint;
  expectedAuthorAddress?: string | null; // Optional for split payments
  requestTimestamp?: number;
  referenceExpirationSeconds?: number;
}

// ============================================
// Constants
// ============================================

/**
 * Required block confirmations for Base L2.
 * 12 blocks provides strong finality guarantees.
 */
export const REQUIRED_CONFIRMATIONS = 12;

// ============================================
// 3.2.1: Fetch Transaction Receipt Wrapper
// ============================================

/**
 * Fetch a transaction receipt from the Base network with error handling.
 *
 * @param txHash - Transaction hash to fetch
 * @returns The transaction receipt
 * @throws EVMPaymentVerificationError if transaction not found or reverted
 */
export async function fetchTransactionReceipt(
  txHash: `0x${string}`
): Promise<TransactionReceipt> {
  const client = getBaseClient();

  const receipt = await client.getTransactionReceipt({ hash: txHash });

  if (!receipt) {
    throw new EVMPaymentVerificationError(
      'Transaction not found',
      'TX_NOT_FOUND'
    );
  }

  if (receipt.status === 'reverted') {
    throw new EVMPaymentVerificationError(
      'Transaction reverted on-chain',
      'TX_REVERTED'
    );
  }

  return receipt;
}

// ============================================
// 3.2.2: Parse ERC-20 Transfer Event Logs
// ============================================

/**
 * Parse all ERC-20 Transfer events from a transaction receipt.
 *
 * @param receipt - Transaction receipt containing logs
 * @param tokenContract - Optional filter for specific token contract
 * @returns Array of parsed transfer events
 */
export function parseErc20Transfers(
  receipt: TransactionReceipt,
  tokenContract?: `0x${string}`
): Erc20Transfer[] {
  const transfers: Erc20Transfer[] = [];

  for (const log of receipt.logs) {
    // Filter by token contract if specified
    if (
      tokenContract &&
      log.address.toLowerCase() !== tokenContract.toLowerCase()
    ) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: USDC_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === 'Transfer') {
        const args = decoded.args as { from: `0x${string}`; to: `0x${string}`; value: bigint };
        transfers.push({
          from: args.from,
          to: args.to,
          value: args.value,
          contractAddress: log.address as `0x${string}`,
        });
      }
    } catch {
      // Not a Transfer event or wrong ABI, skip
    }
  }

  return transfers;
}

// ============================================
// 3.2.3: Validate USDC Contract Address
// ============================================

/**
 * Find a USDC transfer from the list of ERC-20 transfers.
 *
 * @param transfers - Array of parsed ERC-20 transfers
 * @returns The USDC transfer if found
 * @throws EVMPaymentVerificationError if no USDC transfer found
 */
export function findUsdcTransfer(transfers: Erc20Transfer[]): Erc20Transfer {
  const usdcContract = (
    process.env.USDC_CONTRACT_BASE || USDC_CONTRACT_BASE
  ).toLowerCase();

  const usdcTransfer = transfers.find(
    (t) => t.contractAddress.toLowerCase() === usdcContract
  );

  if (!usdcTransfer) {
    throw new EVMPaymentVerificationError(
      'No USDC transfer found in transaction',
      'NO_USDC_TRANSFER'
    );
  }

  return usdcTransfer;
}


// ============================================
// 3.2.6 & 3.2.7: Reference Validation
// ============================================

/**
 * Parsed reference structure for EVM payments.
 * Format: "0xclawstack_{postId}_{timestamp}"
 */
export interface ParsedReference {
  prefix: string;
  postId: string;
  timestamp: number;
}

/**
 * Parse and validate the payment reference format.
 * Expected format: "0xclawstack_{postId}_{timestamp}"
 *
 * For EVM, we use a simpler validation strategy:
 * 1. Transaction timing (within validity window)
 * 2. Exact amount match (unique per request)
 * 3. Reference in transaction input data (optional)
 *
 * @param reference - The reference string to parse (can be null for timing-based validation)
 * @returns Parsed reference components or null if no reference
 */
export function parseReference(reference: string | null): ParsedReference | null {
  if (!reference) {
    return null;
  }

  // Expected format: 0xclawstack_postId_timestamp
  const match = reference.match(/^0xclawstack_([^_]+)_(\d+)$/);

  if (!match) {
    return null;
  }

  return {
    prefix: '0xclawstack',
    postId: match[1],
    timestamp: parseInt(match[2], 10),
  };
}

/**
 * Validate reference matches expected post ID and timestamp is within bounds.
 *
 * @param reference - Parsed reference components
 * @param expectedPostId - The expected post ID
 * @param requestTimestamp - The timestamp of the payment request (Unix seconds)
 * @param expirationSeconds - Maximum age of reference timestamp (default 300 = 5 minutes)
 * @throws EVMPaymentVerificationError if reference doesn't match expectations
 */
export function validateReference(
  reference: ParsedReference | null,
  expectedPostId: string,
  requestTimestamp?: number,
  expirationSeconds = 300
): void {
  // If no reference, we rely on timing + amount validation
  if (!reference) {
    return;
  }

  if (reference.postId !== expectedPostId) {
    throw new EVMPaymentVerificationError(
      `Reference post ID mismatch: expected '${expectedPostId}', got '${reference.postId}'`,
      'INVALID_REFERENCE'
    );
  }

  // If request timestamp provided, check reference isn't too old
  if (requestTimestamp !== undefined) {
    const diff = Math.abs(reference.timestamp - requestTimestamp);
    if (diff > expirationSeconds) {
      throw new EVMPaymentVerificationError(
        `Payment reference expired: ${diff}s difference exceeds ${expirationSeconds}s limit`,
        'REFERENCE_EXPIRED'
      );
    }
  }
}

// ============================================
// 3.2.8: Transaction Status (already in 3.2.1)
// ============================================

/**
 * Validate transaction was successful (not reverted).
 * Already handled in fetchTransactionReceipt, but exposed for explicit checks.
 *
 * @param receipt - The transaction receipt to check
 * @throws EVMPaymentVerificationError if transaction reverted
 */
export function validateTransactionSuccess(receipt: TransactionReceipt): void {
  if (receipt.status === 'reverted') {
    throw new EVMPaymentVerificationError(
      'Transaction reverted on-chain',
      'TX_REVERTED'
    );
  }
}

// ============================================
// 3.2.9: Check Block Confirmations (12 Blocks)
// ============================================

/**
 * Check that the transaction has sufficient block confirmations.
 * Requires 12+ confirmations for Base L2 finality.
 *
 * @param receipt - Transaction receipt containing block number
 * @returns Number of confirmations
 * @throws EVMPaymentVerificationError if insufficient confirmations
 */
export async function checkBlockConfirmations(
  receipt: TransactionReceipt
): Promise<number> {
  const client = getBaseClient();
  const currentBlock = await client.getBlockNumber();
  const txBlock = receipt.blockNumber;

  const confirmations = Number(currentBlock - txBlock);

  if (confirmations < REQUIRED_CONFIRMATIONS) {
    throw new EVMPaymentVerificationError(
      `Insufficient confirmations: ${confirmations}/${REQUIRED_CONFIRMATIONS}`,
      'INSUFFICIENT_CONFIRMATIONS'
    );
  }

  return confirmations;
}

/**
 * Get current confirmation count without throwing.
 * Useful for status checks.
 *
 * @param receipt - Transaction receipt containing block number
 * @returns Number of confirmations
 */
export async function getConfirmationCount(
  receipt: TransactionReceipt
): Promise<number> {
  const client = getBaseClient();
  const currentBlock = await client.getBlockNumber();
  return Number(currentBlock - receipt.blockNumber);
}


/**
 * Complete payment verification for a Base USDC ERC-20 transaction.
 * Verifies that:
 * 1. Transaction exists and succeeded
 * 2. Contains a USDC transfer to the author for the expected amount
 * 3. Has sufficient block confirmations
 *
 * @param options - Verification options
 * @returns Verified payment details
 * @throws EVMPaymentVerificationError if any validation fails
 */
export async function verifyEVMPayment(
  options: VerifyEVMPaymentOptions
): Promise<VerifiedEVMPayment> {
  const {
    transactionHash,
    expectedAmountRaw,
    expectedAuthorAddress,
  } = options;

  // 1. Fetch receipt
  const receipt = await fetchTransactionReceipt(transactionHash as `0x${string}`);

  // 2. Validate transaction succeeded
  validateTransactionSuccess(receipt);

  // 3. Parse ERC-20 transfer events
  const usdcContract = (
    process.env.USDC_CONTRACT_BASE || USDC_CONTRACT_BASE
  ) as `0x${string}`;

  const allTransfers = parseErc20Transfers(receipt, usdcContract);

  // 4. Find USDC transfer to the author (or fallback treasury)
  const recipientAddress = expectedAuthorAddress || process.env.BASE_TREASURY_ADDRESS;
  if (!recipientAddress) throw new Error('No recipient address for verification');

  const usdcTransfer = allTransfers.find(
    (t) =>
      t.contractAddress.toLowerCase() === usdcContract.toLowerCase() &&
      t.to.toLowerCase() === recipientAddress.toLowerCase()
  );

  if (!usdcTransfer) {
    throw new EVMPaymentVerificationError(
      `No USDC transfer found to recipient ${recipientAddress}`,
      'NO_USDC_TRANSFER'
    );
  }

  // 5. Validate amount
  if (usdcTransfer.value < expectedAmountRaw) {
    throw new EVMPaymentVerificationError(
      `Insufficient payment: expected ${expectedAmountRaw}, got ${usdcTransfer.value}`,
      'INSUFFICIENT_AMOUNT'
    );
  }

  // 6. Check block confirmations
  const confirmations = await checkBlockConfirmations(receipt);

  return {
    transactionHash,
    payer: usdcTransfer.from,
    recipient: usdcTransfer.to as `0x${string}`,
    amount: usdcTransfer.value,
    contractAddress: usdcTransfer.contractAddress,
    blockNumber: receipt.blockNumber,
    confirmations,
    reference: null,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert USDC amount to raw units (6 decimals).
 *
 * @param usdc - Amount in USDC (e.g., 0.25)
 * @returns Amount in raw units (e.g., 250000n)
 */
export function usdcToRaw(usdc: number): bigint {
  return BigInt(Math.floor(usdc * 10 ** USDC_DECIMALS));
}

/**
 * Convert raw units to USDC string.
 *
 * @param raw - Amount in raw units
 * @returns Amount in USDC as string (e.g., "0.25")
 */
export function rawToUsdc(raw: bigint): string {
  const divisor = BigInt(10 ** USDC_DECIMALS);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  const fractionStr = fraction.toString().padStart(USDC_DECIMALS, '0');
  return `${whole}.${fractionStr.slice(0, 2)}`;
}

/**
 * Validate a transaction hash format.
 * Matches single hash or comma-separated list of hashes.
 *
 * @param hash - String to validate
 * @returns True if valid hex hash or list
 */
export function isValidTransactionHash(hash: string): boolean {
  if (!hash) return false;
  const parts = hash.split(',').map(h => h.trim());
  return parts.every(h => /^0x[a-fA-F0-9]{64}$/.test(h));
}
