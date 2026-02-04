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
