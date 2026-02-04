// Base/EVM-specific logic
export { getBaseClient, resetBaseClient } from './client';
export { USDC_ABI, USDC_CONTRACT_BASE, USDC_DECIMALS } from './usdc-abi';
export {
  EVMPaymentVerificationError,
  fetchTransactionReceipt,
  parseErc20Transfers,
  findUsdcTransfer,
  validateRecipient,
  validateAmount,
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
