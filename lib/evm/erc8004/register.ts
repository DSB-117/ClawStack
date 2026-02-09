/**
 * ERC-8004 On-Chain Registration
 *
 * Prepares unsigned transactions for registering agents on-chain
 * via the ERC-8004 Identity Registry. Supports three URI strategies:
 * - IPFS URI (via Pinata)
 * - HTTP URL (self-hosted or ClawStack-hosted)
 * - Data URI (fully on-chain, base64-encoded)
 *
 * The caller is responsible for signing and submitting the transaction
 * (either client-side via wallet, or server-side via AgentKit).
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004
 */

import { encodeFunctionData } from 'viem';
import { ERC8004_IDENTITY_REGISTRY_ABI } from './abi';
import { getERC8004Addresses, isERC8004SupportedChain } from './addresses';

// ============================================
// Types
// ============================================

/**
 * URI strategy for agent registration
 */
export type RegistrationURIStrategy = 'ipfs' | 'http' | 'data_uri';

/**
 * Prepared registration transaction
 */
export interface PreparedRegistrationTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value: '0';
  chainId: number;
  /** Human-readable description */
  description: string;
  /** The agent URI that will be registered */
  agentURI: string;
  /** Estimated gas (approximate) */
  estimatedGas: string;
}

// ============================================
// Registration Functions
// ============================================

/**
 * Prepare an unsigned transaction to register an agent on-chain.
 *
 * Calls `register(string agentURI)` on the Identity Registry.
 * Returns the agent's ERC-721 token ID in the transaction receipt logs.
 *
 * @param agentURI - The URI pointing to the agent's registration JSON
 * @param chainId - The chain ID to register on
 * @returns Prepared transaction data ready for signing
 */
export function prepareRegistrationTransaction(
  agentURI: string,
  chainId: number
): PreparedRegistrationTx {
  if (!isERC8004SupportedChain(chainId)) {
    throw new Error(`Chain ${chainId} is not supported for ERC-8004`);
  }

  if (!agentURI || agentURI.length === 0) {
    throw new Error('agentURI is required for registration');
  }

  const addresses = getERC8004Addresses(chainId);

  const data = encodeFunctionData({
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [agentURI],
  });

  // Estimate gas based on URI strategy
  const isDataURI = agentURI.startsWith('data:');
  const estimatedGas = isDataURI ? '300000' : '150000';

  return {
    to: addresses.identityRegistry,
    data,
    value: '0',
    chainId,
    description: `Register agent on ERC-8004 Identity Registry (chain ${chainId})`,
    agentURI,
    estimatedGas,
  };
}

/**
 * Prepare an unsigned transaction to register an agent with no URI.
 *
 * Calls `register()` (no arguments) on the Identity Registry.
 * The agent can set their URI later via `setAgentURI`.
 *
 * @param chainId - The chain ID to register on
 * @returns Prepared transaction data ready for signing
 */
export function prepareMinimalRegistration(
  chainId: number
): PreparedRegistrationTx {
  if (!isERC8004SupportedChain(chainId)) {
    throw new Error(`Chain ${chainId} is not supported for ERC-8004`);
  }

  const addresses = getERC8004Addresses(chainId);

  // Use the no-argument register() overload
  const data = encodeFunctionData({
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [],
  });

  return {
    to: addresses.identityRegistry,
    data,
    value: '0',
    chainId,
    description: `Register agent on ERC-8004 Identity Registry with no URI (chain ${chainId})`,
    agentURI: '',
    estimatedGas: '120000',
  };
}
