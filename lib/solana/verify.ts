import {
  ParsedTransactionWithMeta,
  PublicKey,
  Connection,
  ParsedInstruction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getTransactionWithFallback, getSolanaConnection } from './client';

/**
 * Error class for payment verification failures.
 * Contains structured error codes for agent-parseable responses.
 */
export class PaymentVerificationError extends Error {
  public readonly code: string;

  constructor(
    message: string,
    code:
      | 'TX_NOT_FOUND'
      | 'TX_FAILED'
      | 'NO_USDC_TRANSFER'
      | 'WRONG_RECIPIENT'
      | 'INSUFFICIENT_AMOUNT'
      | 'INVALID_MEMO'
      | 'MEMO_EXPIRED'
      | 'NOT_CONFIRMED'
      | 'STATUS_UNKNOWN' = 'TX_NOT_FOUND'
  ) {
    super(message);
    this.name = 'PaymentVerificationError';
    this.code = code;
  }
}

/**
 * Memo Program ID for Solana memo instructions.
 */
const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
);

/**
 * Interface for parsed SPL token transfers.
 */
export interface TokenTransfer {
  source: string;
  destination: string;
  amount: bigint;
  mint: string;
}

/**
 * Verified payment result returned after successful verification.
 */
export interface VerifiedPayment {
  signature: string;
  payer: string;
  recipient: string;
  amount: bigint;
  mint: string;
  memo: string | null;
  postId: string | null;
  timestamp: number | null;
  confirmationStatus: 'confirmed' | 'finalized';
}

/**
 * Options for verifying a payment.
 */
export interface VerifyPaymentOptions {
  signature: string;
  expectedPostId: string;
  expectedAmountRaw: bigint;
  requestTimestamp?: number;
  memoExpirationSeconds?: number;
}

// ============================================
// 2.2.1: Fetch Transaction Wrapper
// ============================================

/**
 * Fetch a parsed transaction from the Solana network with error handling.
 * Uses fallback RPC endpoints if primary fails.
 *
 * @param signature - Transaction signature to fetch
 * @returns The parsed transaction with metadata
 * @throws PaymentVerificationError if transaction not found or failed
 */
export async function fetchTransaction(
  signature: string
): Promise<ParsedTransactionWithMeta> {
  const tx = await getTransactionWithFallback(signature);

  if (!tx) {
    throw new PaymentVerificationError(
      'Transaction not found',
      'TX_NOT_FOUND'
    );
  }

  if (tx.meta?.err) {
    const errorMsg = JSON.stringify(tx.meta.err);
    throw new PaymentVerificationError(
      `Transaction failed on-chain: ${errorMsg}`,
      'TX_FAILED'
    );
  }

  return tx;
}

// ============================================
// 2.2.2: Parse SPL Token Transfer Instructions
// ============================================

/**
 * Type for parsed SPL token transfer info.
 */
interface ParsedTransferInfo {
  source: string;
  destination: string;
  amount?: string;
  tokenAmount?: { amount: string };
  mint?: string;
}

/**
 * Type guard to check if an instruction has parsed data.
 */
function hasParsedData(
  ix: unknown
): ix is { programId: PublicKey; parsed: { type: string; info: ParsedTransferInfo } } {
  return (
    typeof ix === 'object' &&
    ix !== null &&
    'programId' in ix &&
    'parsed' in ix &&
    typeof (ix as { parsed: unknown }).parsed === 'object'
  );
}

/**
 * Extract transfer from a parsed instruction if applicable.
 */
function extractTransferFromInstruction(
  ix: unknown
): TokenTransfer | null {
  if (!hasParsedData(ix)) {
    return null;
  }

  if (!ix.programId.equals(TOKEN_PROGRAM_ID)) {
    return null;
  }

  const parsed = ix.parsed;
  if (parsed.type !== 'transfer' && parsed.type !== 'transferChecked') {
    return null;
  }

  const info = parsed.info;
  return {
    source: info.source,
    destination: info.destination,
    amount: BigInt(info.amount || info.tokenAmount?.amount || '0'),
    mint: info.mint || '',
  };
}

/**
 * Parse all SPL token transfers from a transaction.
 * Handles both 'transfer' and 'transferChecked' instruction types.
 *
 * @param tx - The parsed transaction with metadata
 * @returns Array of token transfer details
 */
export function parseTokenTransfers(
  tx: ParsedTransactionWithMeta
): TokenTransfer[] {
  const transfers: TokenTransfer[] = [];

  // Check top-level instructions
  for (const ix of tx.transaction.message.instructions) {
    const transfer = extractTransferFromInstruction(ix);
    if (transfer) {
      transfers.push(transfer);
    }
  }

  // Also check inner instructions (for composed transactions)
  for (const inner of tx.meta?.innerInstructions || []) {
    for (const ix of inner.instructions) {
      const transfer = extractTransferFromInstruction(ix);
      if (transfer) {
        transfers.push(transfer);
      }
    }
  }

  return transfers;
}

// ============================================
// 2.2.3: Validate USDC Mint Address
// ============================================

/**
 * Find a USDC transfer from the list of token transfers.
 * Uses the USDC mint address from environment variable.
 *
 * @param transfers - Array of parsed token transfers
 * @returns The USDC transfer if found
 * @throws PaymentVerificationError if no USDC transfer found
 */
export function findUsdcTransfer(transfers: TokenTransfer[]): TokenTransfer {
  const usdcMint = process.env.USDC_MINT_SOLANA;

  if (!usdcMint) {
    throw new Error('USDC_MINT_SOLANA environment variable is not set');
  }

  const usdcTransfer = transfers.find((t) => t.mint === usdcMint);

  if (!usdcTransfer) {
    throw new PaymentVerificationError(
      'No USDC transfer found in transaction',
      'NO_USDC_TRANSFER'
    );
  }

  return usdcTransfer;
}

// ============================================
// 2.2.4: Validate Recipient Matches Expected
// ============================================

/**
 * Validate that the USDC transfer recipient matches the expected treasury address.
 *
 * @param transfer - The USDC transfer to validate
 * @throws PaymentVerificationError if recipient doesn't match
 */
export function validateRecipient(transfer: TokenTransfer): void {
  const expectedRecipient = process.env.SOLANA_TREASURY_PUBKEY;

  if (!expectedRecipient) {
    throw new Error('SOLANA_TREASURY_PUBKEY environment variable is not set');
  }

  if (transfer.destination !== expectedRecipient) {
    throw new PaymentVerificationError(
      `Payment sent to wrong recipient: expected ${expectedRecipient}, got ${transfer.destination}`,
      'WRONG_RECIPIENT'
    );
  }
}

// ============================================
// 2.2.5: Validate Amount Meets Minimum
// ============================================

/**
 * Validate that the payment amount meets the minimum required.
 * Accepts overpayment but rejects underpayment.
 *
 * @param transfer - The USDC transfer to validate
 * @param expectedAmountRaw - Expected amount in raw units (6 decimals for USDC)
 * @throws PaymentVerificationError if amount is insufficient
 */
export function validateAmount(
  transfer: TokenTransfer,
  expectedAmountRaw: bigint
): void {
  if (transfer.amount < expectedAmountRaw) {
    throw new PaymentVerificationError(
      `Insufficient payment: expected ${expectedAmountRaw}, got ${transfer.amount}`,
      'INSUFFICIENT_AMOUNT'
    );
  }
}

// ============================================
// 2.2.6: Parse Memo Instruction for Reference
// ============================================

/**
 * Extract memo from a single instruction if it's a memo instruction.
 */
function extractMemoFromInstruction(ix: unknown): string | null {
  if (typeof ix !== 'object' || ix === null || !('programId' in ix)) {
    return null;
  }

  const instruction = ix as { programId: PublicKey; parsed?: unknown; data?: string };

  if (!instruction.programId.equals(MEMO_PROGRAM_ID)) {
    return null;
  }

  // Check for parsed memo
  if ('parsed' in instruction && instruction.parsed !== undefined) {
    return String(instruction.parsed);
  }

  // Check for raw data (base58 encoded memo)
  if ('data' in instruction && typeof instruction.data === 'string') {
    return instruction.data;
  }

  return null;
}

/**
 * Extract memo from a transaction.
 * Checks both top-level and inner instructions.
 *
 * @param tx - The parsed transaction with metadata
 * @returns The memo string if found, null otherwise
 */
export function parseMemo(tx: ParsedTransactionWithMeta): string | null {
  // Check top-level instructions
  for (const ix of tx.transaction.message.instructions) {
    const memo = extractMemoFromInstruction(ix);
    if (memo !== null) {
      return memo;
    }
  }

  // Also check inner instructions
  for (const inner of tx.meta?.innerInstructions || []) {
    for (const ix of inner.instructions) {
      const memo = extractMemoFromInstruction(ix);
      if (memo !== null) {
        return memo;
      }
    }
  }

  return null;
}

// ============================================
// 2.2.7: Validate Memo Matches Resource
// ============================================

/**
 * Parsed memo structure.
 */
export interface ParsedMemo {
  prefix: string;
  postId: string;
  timestamp: number;
}

/**
 * Parse and validate the payment memo format.
 * Expected format: "clawstack:post_abc123:1706960000"
 *
 * @param memo - The memo string to parse
 * @returns Parsed memo components
 * @throws PaymentVerificationError if memo format is invalid
 */
export function parseMemoFormat(memo: string | null): ParsedMemo {
  if (!memo) {
    throw new PaymentVerificationError('Missing payment memo', 'INVALID_MEMO');
  }

  const parts = memo.split(':');

  if (parts.length !== 3) {
    throw new PaymentVerificationError(
      `Invalid memo format: expected 3 parts, got ${parts.length}`,
      'INVALID_MEMO'
    );
  }

  const [prefix, postId, timestampStr] = parts;

  if (prefix !== 'clawstack') {
    throw new PaymentVerificationError(
      `Invalid memo prefix: expected 'clawstack', got '${prefix}'`,
      'INVALID_MEMO'
    );
  }

  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp)) {
    throw new PaymentVerificationError(
      `Invalid memo timestamp: ${timestampStr}`,
      'INVALID_MEMO'
    );
  }

  return { prefix, postId, timestamp };
}

/**
 * Validate memo matches expected post ID and timestamp is within bounds.
 *
 * @param memo - Parsed memo components
 * @param expectedPostId - The expected post ID
 * @param requestTimestamp - The timestamp of the payment request (Unix seconds)
 * @param expirationSeconds - Maximum age of memo timestamp (default 300 = 5 minutes)
 * @throws PaymentVerificationError if memo doesn't match expectations
 */
export function validateMemo(
  memo: ParsedMemo,
  expectedPostId: string,
  requestTimestamp?: number,
  expirationSeconds = 300
): void {
  if (memo.postId !== expectedPostId) {
    throw new PaymentVerificationError(
      `Memo post ID mismatch: expected '${expectedPostId}', got '${memo.postId}'`,
      'INVALID_MEMO'
    );
  }

  // If request timestamp provided, check memo isn't too old
  if (requestTimestamp !== undefined) {
    const diff = Math.abs(memo.timestamp - requestTimestamp);
    if (diff > expirationSeconds) {
      throw new PaymentVerificationError(
        `Payment memo expired: ${diff}s difference exceeds ${expirationSeconds}s limit`,
        'MEMO_EXPIRED'
      );
    }
  }
}

// ============================================
// 2.2.8: Check Transaction Finality
// ============================================

/**
 * Check the confirmation status of a transaction.
 * Requires at least 'confirmed' status for payment acceptance.
 *
 * @param signature - Transaction signature to check
 * @param connection - Optional Solana connection (uses singleton if not provided)
 * @returns The confirmation status ('confirmed' or 'finalized')
 * @throws PaymentVerificationError if not sufficiently confirmed
 */
export async function checkTransactionFinality(
  signature: string,
  connection?: Connection
): Promise<'confirmed' | 'finalized'> {
  const conn = connection || getSolanaConnection();
  const status = await conn.getSignatureStatus(signature);

  if (!status.value) {
    throw new PaymentVerificationError(
      'Transaction status unknown',
      'STATUS_UNKNOWN'
    );
  }

  const confirmationStatus = status.value.confirmationStatus;

  if (confirmationStatus !== 'confirmed' && confirmationStatus !== 'finalized') {
    throw new PaymentVerificationError(
      `Transaction not yet confirmed: status is '${confirmationStatus || 'pending'}'`,
      'NOT_CONFIRMED'
    );
  }

  return confirmationStatus;
}

// ============================================
// 2.2.9: Handle Partial/Failed Transactions
// ============================================

/**
 * Validate transaction was successful (no errors).
 * Already handled in fetchTransaction, but exposed for explicit checks.
 *
 * @param tx - The parsed transaction to check
 * @throws PaymentVerificationError if transaction failed
 */
export function validateTransactionSuccess(
  tx: ParsedTransactionWithMeta
): void {
  if (tx.meta?.err) {
    const errorMsg = JSON.stringify(tx.meta.err);
    throw new PaymentVerificationError(
      `Transaction failed: ${errorMsg}`,
      'TX_FAILED'
    );
  }
}

// ============================================
// Main Verification Function (combines all checks)
// ============================================

/**
 * Complete payment verification for a Solana USDC transaction.
 * Performs all validation checks in sequence:
 * 1. Fetch transaction with fallback
 * 2. Check transaction success (no errors)
 * 3. Parse token transfers
 * 4. Find USDC transfer
 * 5. Validate recipient
 * 6. Validate amount
 * 7. Parse and validate memo
 * 8. Check transaction finality
 *
 * @param options - Verification options
 * @returns Verified payment details
 * @throws PaymentVerificationError if any validation fails
 */
export async function verifyPayment(
  options: VerifyPaymentOptions
): Promise<VerifiedPayment> {
  const {
    signature,
    expectedPostId,
    expectedAmountRaw,
    requestTimestamp,
    memoExpirationSeconds = 300,
  } = options;

  // 1. Fetch transaction (also checks for on-chain errors)
  const tx = await fetchTransaction(signature);

  // 2. Validate transaction success (explicit double-check)
  validateTransactionSuccess(tx);

  // 3. Parse all token transfers
  const transfers = parseTokenTransfers(tx);

  // 4. Find USDC transfer
  const usdcTransfer = findUsdcTransfer(transfers);

  // 5. Validate recipient
  validateRecipient(usdcTransfer);

  // 6. Validate amount
  validateAmount(usdcTransfer, expectedAmountRaw);

  // 7. Parse and validate memo
  const memoStr = parseMemo(tx);
  const parsedMemo = parseMemoFormat(memoStr);
  validateMemo(parsedMemo, expectedPostId, requestTimestamp, memoExpirationSeconds);

  // 8. Check transaction finality
  const confirmationStatus = await checkTransactionFinality(signature);

  // Return verified payment details
  return {
    signature,
    payer: usdcTransfer.source,
    recipient: usdcTransfer.destination,
    amount: usdcTransfer.amount,
    mint: usdcTransfer.mint,
    memo: memoStr,
    postId: parsedMemo.postId,
    timestamp: parsedMemo.timestamp,
    confirmationStatus,
  };
}
