import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// USDC Token Mint on Solana Mainnet
export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

/**
 * Convert USDC amount to atomic units (smallest unit)
 * @param usdcAmount - Amount in USDC (e.g., 0.25)
 * @returns Amount in atomic units as bigint
 */
export function usdcToAtomic(usdcAmount: number): bigint {
  return BigInt(Math.round(usdcAmount * Math.pow(10, USDC_DECIMALS)));
}

/**
 * Convert atomic units back to USDC
 * @param atomicAmount - Amount in atomic units
 * @returns Amount in USDC
 */
export function atomicToUsdc(atomicAmount: bigint): number {
  return Number(atomicAmount) / Math.pow(10, USDC_DECIMALS);
}

/**
 * Get the USDC balance for a wallet address
 * @param connection - Solana connection
 * @param walletAddress - Wallet public key
 * @returns Balance in USDC, or 0 if no token account exists
 */
export async function getUsdcBalance(
  connection: Connection,
  walletAddress: PublicKey
): Promise<number> {
  try {
    const tokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      walletAddress
    );

    const account = await getAccount(connection, tokenAccount);
    return atomicToUsdc(account.amount);
  } catch (error) {
    // Token account doesn't exist or other error
    console.warn("Error fetching USDC balance:", error);
    return 0;
  }
}

/**
 * Get the USDC balance in atomic units
 * @param connection - Solana connection
 * @param walletAddress - Wallet public key
 * @returns Balance in atomic units (bigint)
 */
export async function getUsdcBalanceRaw(
  connection: Connection,
  walletAddress: PublicKey
): Promise<bigint> {
  try {
    const tokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      walletAddress
    );

    const account = await getAccount(connection, tokenAccount);
    return account.amount;
  } catch {
    return BigInt(0);
  }
}

export interface CreatePaymentTransactionParams {
  connection: Connection;
  payerPublicKey: PublicKey;
  recipientAddress: string;
  amountUsdc: number;
  memo: string;
}

export interface PaymentTransactionResult {
  transaction: Transaction;
  amountRaw: bigint;
}

/**
 * Create a USDC payment transaction
 * @returns Transaction ready to be signed and sent
 */
export async function createUsdcPaymentTransaction({
  connection,
  payerPublicKey,
  recipientAddress,
  amountUsdc,
  memo,
}: CreatePaymentTransactionParams): Promise<PaymentTransactionResult> {
  const recipientPubkey = new PublicKey(recipientAddress);
  const amountRaw = usdcToAtomic(amountUsdc);

  // Get associated token accounts
  const payerTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    payerPublicKey
  );

  const recipientTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    recipientPubkey
  );

  // Create the transfer instruction
  const transferInstruction = createTransferInstruction(
    payerTokenAccount,
    recipientTokenAccount,
    payerPublicKey,
    amountRaw,
    [],
    TOKEN_PROGRAM_ID
  );

  // Create memo instruction for payment tracking
  // Using a simple memo via SystemProgram.transfer with 0 lamports
  // In production, use the SPL Memo program for proper memo support
  const memoData = Buffer.from(memo, "utf-8");

  // Build the transaction
  const transaction = new Transaction();

  // Add recent blockhash and fee payer
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = payerPublicKey;

  // Add the transfer instruction
  transaction.add(transferInstruction);

  return {
    transaction,
    amountRaw,
  };
}

export interface PaymentConfirmationResult {
  signature: string;
  confirmed: boolean;
  slot: number;
  blockTime: number | null;
  error?: string;
}

/**
 * Wait for transaction confirmation
 * @param connection - Solana connection
 * @param signature - Transaction signature
 * @param timeout - Timeout in milliseconds (default 60s)
 * @returns Confirmation result
 */
export async function waitForConfirmation(
  connection: Connection,
  signature: string,
  timeout = 60000
): Promise<PaymentConfirmationResult> {
  const start = Date.now();

  try {
    // Wait for confirmation with 'confirmed' commitment
    const result = await connection.confirmTransaction(
      {
        signature,
        blockhash: (await connection.getLatestBlockhash()).blockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash())
          .lastValidBlockHeight,
      },
      "confirmed"
    );

    if (result.value.err) {
      return {
        signature,
        confirmed: false,
        slot: 0,
        blockTime: null,
        error: JSON.stringify(result.value.err),
      };
    }

    // Get transaction details for slot and block time
    const txDetails = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    return {
      signature,
      confirmed: true,
      slot: txDetails?.slot || 0,
      blockTime: txDetails?.blockTime || null,
    };
  } catch (error) {
    const elapsed = Date.now() - start;
    if (elapsed >= timeout) {
      return {
        signature,
        confirmed: false,
        slot: 0,
        blockTime: null,
        error: "Transaction confirmation timeout",
      };
    }
    return {
      signature,
      confirmed: false,
      slot: 0,
      blockTime: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Validate a Solana public key string
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
