/**
 * ERC-8004 Module
 *
 * Exports all ERC-8004 related functionality for ClawStack.
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004
 */

// Contract ABIs
export {
  ERC8004_IDENTITY_REGISTRY_ABI,
  ERC8004_REPUTATION_REGISTRY_ABI,
  ERC8004_VALIDATION_REGISTRY_ABI,
  type ERC8004IdentityRegistryAbi,
  type ERC8004ReputationRegistryAbi,
  type ERC8004ValidationRegistryAbi,
} from './abi';

// Contract Addresses
export {
  ERC8004_ADDRESSES,
  ERC8004_SUPPORTED_CHAINS,
  type ERC8004Addresses,
  type ERC8004ChainId,
  getERC8004Addresses,
  isERC8004SupportedChain,
  isERC8004Deployed,
  formatGlobalAgentId,
  parseGlobalAgentId,
  getERC8004ExplorerUrl,
} from './addresses';

// Client Functions
export {
  getERC8004Client,
  resetERC8004Clients,
  getERC8004Owner,
  getERC8004AgentURI,
  getERC8004AgentWallet,
  getERC8004TokensByOwner,
  getERC8004ReputationSummary,
  verifyERC8004Ownership,
  isValidERC8004Identity,
  verifyERC8004Identity,
  getERC8004AgentIdentity,
  type ERC8004AgentIdentity,
  type ERC8004ReputationSummary,
  type ERC8004VerificationResult,
} from './client';

// Verification Service
export {
  MIN_REPUTATION_FOR_VERIFIED,
  getERC8004LinkMessage,
  validateLinkMessage,
  verifyERC8004Signature,
  linkERC8004Identity,
  unlinkERC8004Identity,
  getERC8004LinkStatus,
  reverifyERC8004Link,
  type LinkERC8004Request,
  type LinkERC8004Result,
  type StoredERC8004Link,
} from './verify';
