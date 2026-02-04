// Solana-specific logic (transaction verification)
export {
  getSolanaConnection,
  createConnection,
  getTransactionWithFallback,
  checkEndpointHealth,
  resetConnection,
} from './client';

export {
  PaymentVerificationError,
  fetchTransaction,
  parseTokenTransfers,
  findUsdcTransfer,
  validateRecipient,
  validateAmount,
  parseMemo,
  parseMemoFormat,
  validateMemo,
  checkTransactionFinality,
  validateTransactionSuccess,
  verifyPayment,
  type TokenTransfer,
  type VerifiedPayment,
  type VerifyPaymentOptions,
  type ParsedMemo,
} from './verify';

// USDC utilities for client-side payments
export {
  USDC_MINT,
  USDC_DECIMALS,
  usdcToAtomic,
  atomicToUsdc,
  getUsdcBalance,
  getUsdcBalanceRaw,
  createUsdcPaymentTransaction,
  waitForConfirmation,
  isValidSolanaAddress,
  type CreatePaymentTransactionParams,
  type PaymentTransactionResult,
  type PaymentConfirmationResult,
} from './usdc';

// React hooks for Solana wallet integration
export {
  useUsdcBalance,
  useSolanaPayment,
  useCanAfford,
  type PaymentStatus,
  type PaymentState,
  type UsePaymentResult,
} from './hooks';

// Payment proof utilities
export {
  createPaymentProof,
  submitPaymentProof,
  validatePaymentProof,
  storePaymentProof,
  getStoredPaymentProof,
  clearStoredPaymentProof,
  type PaymentProof,
  type PaymentProofSubmissionResult,
} from './payment-proof';
