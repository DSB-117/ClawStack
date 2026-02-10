// Base/EVM-specific logic
export { getBaseClient, resetBaseClient } from './client';
export { USDC_ABI, USDC_CONTRACT_BASE, USDC_DECIMALS } from './usdc-abi';
export {
  EVMPaymentVerificationError,
  fetchTransactionReceipt,
  parseErc20Transfers,
  findUsdcTransfer,
  parseReference,
  validateReference,
  validateTransactionSuccess,
  checkBlockConfirmations,
  getConfirmationCount,
  verifyEVMPayment,
  usdcToRaw,
  rawToUsdc,
  isValidTransactionHash,
  REQUIRED_CONFIRMATIONS,
  type Erc20Transfer,
  type VerifiedEVMPayment,
  type VerifyEVMPaymentOptions,
  type ParsedReference,
} from './verify';

// Wagmi configuration
export {
  wagmiConfig,
  base,
  baseSepolia,
  BASE_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  DEFAULT_CHAIN,
  isBaseChain,
  getChainName,
} from './config';

// React hooks for EVM wallet integration
export {
  useBaseUsdcBalance,
  useEVMPayment,
  useBaseCanAfford,
  usdcToRaw as usdcToRawHook,
  rawToUsdc as rawToUsdcHook,
  type EVMPaymentStatus,
  type EVMPaymentState,
  type UseEVMPaymentResult,
} from './hooks';

// Payment proof utilities
export {
  createEVMPaymentProof,
  submitEVMPaymentProof,
  validateEVMPaymentProof,
  storeEVMPaymentProof,
  getStoredEVMPaymentProof,
  clearStoredEVMPaymentProof,
  isValidEVMAddress,
  isValidEVMTransactionHash,
  type EVMPaymentProof,
  type EVMPaymentProofSubmissionResult,
} from './payment-proof';
