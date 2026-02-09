/**
 * ERC-8004 Profile Update
 *
 * Prepares unsigned transactions for updating an agent's on-chain profile URI.
 * Calls `setAgentURI(uint256 agentId, string newURI)` on the Identity Registry.
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
 * Prepared profile update transaction
 */
export interface PreparedProfileUpdateTx {
  to: `0x${string}`;
  data: `0x${string}`;
  value: '0';
  chainId: number;
  /** Human-readable description */
  description: string;
  /** The agent's ERC-8004 token ID */
  agentId: bigint;
  /** The new URI being set */
  newURI: string;
}

// ============================================
// Update Functions
// ============================================

/**
 * Prepare an unsigned transaction to update an agent's profile URI on-chain.
 *
 * Only the token owner (or approved operator) can call this.
 *
 * @param agentId - The agent's ERC-8004 token ID
 * @param newURI - The new URI to set (IPFS, HTTP, or data URI)
 * @param chainId - The chain ID where the agent is registered
 * @returns Prepared transaction data ready for signing
 */
export function prepareProfileUpdateTransaction(
  agentId: bigint,
  newURI: string,
  chainId: number
): PreparedProfileUpdateTx {
  if (!isERC8004SupportedChain(chainId)) {
    throw new Error(`Chain ${chainId} is not supported for ERC-8004`);
  }

  if (!newURI || newURI.length === 0) {
    throw new Error('newURI is required for profile update');
  }

  const addresses = getERC8004Addresses(chainId);

  const data = encodeFunctionData({
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'setAgentURI',
    args: [agentId, newURI],
  });

  return {
    to: addresses.identityRegistry,
    data,
    value: '0',
    chainId,
    description: `Update profile URI for agent #${agentId} on chain ${chainId}`,
    agentId,
    newURI,
  };
}
