/**
 * ERC-8004 Contract Addresses
 *
 * Deployment addresses for ERC-8004 registries on supported chains.
 * These are singleton deployments - one set per chain.
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004
 */

import { base, baseSepolia } from 'viem/chains';

/**
 * ERC-8004 registry addresses for a specific chain
 */
export interface ERC8004Addresses {
  identityRegistry: `0x${string}`;
  reputationRegistry: `0x${string}`;
  validationRegistry: `0x${string}`;
}

/**
 * Supported chain IDs for ERC-8004
 */
export const ERC8004_SUPPORTED_CHAINS = [
  base.id,        // 8453 - Base Mainnet
  baseSepolia.id, // 84532 - Base Sepolia
] as const;

export type ERC8004ChainId = (typeof ERC8004_SUPPORTED_CHAINS)[number];

/**
 * ERC-8004 Registry Addresses by Chain
 *
 * Note: Base Mainnet addresses will be updated once deployed.
 * Base Sepolia addresses are for testnet development.
 *
 * @see https://github.com/sudeepb02/awesome-erc8004 for latest deployments
 */
export const ERC8004_ADDRESSES: Record<ERC8004ChainId, ERC8004Addresses> = {
  // Base Mainnet (8453)
  // TODO: Update with actual addresses once ERC-8004 deploys on Base Mainnet
  [base.id]: {
    identityRegistry:
      (process.env.ERC8004_IDENTITY_REGISTRY_BASE as `0x${string}`) ||
      '0x0000000000000000000000000000000000000000',
    reputationRegistry:
      (process.env.ERC8004_REPUTATION_REGISTRY_BASE as `0x${string}`) ||
      '0x0000000000000000000000000000000000000000',
    validationRegistry:
      (process.env.ERC8004_VALIDATION_REGISTRY_BASE as `0x${string}`) ||
      '0x0000000000000000000000000000000000000000',
  },

  // Base Sepolia (84532)
  // Testnet addresses for development
  [baseSepolia.id]: {
    identityRegistry:
      (process.env.ERC8004_IDENTITY_REGISTRY_BASE_SEPOLIA as `0x${string}`) ||
      '0x0000000000000000000000000000000000000000',
    reputationRegistry:
      (process.env.ERC8004_REPUTATION_REGISTRY_BASE_SEPOLIA as `0x${string}`) ||
      '0x0000000000000000000000000000000000000000',
    validationRegistry:
      (process.env.ERC8004_VALIDATION_REGISTRY_BASE_SEPOLIA as `0x${string}`) ||
      '0x0000000000000000000000000000000000000000',
  },
};

/**
 * Get ERC-8004 addresses for a specific chain
 *
 * @param chainId - The chain ID to get addresses for
 * @returns ERC-8004 registry addresses
 * @throws Error if chain is not supported
 */
export function getERC8004Addresses(chainId: number): ERC8004Addresses {
  if (!isERC8004SupportedChain(chainId)) {
    throw new Error(
      `Chain ${chainId} is not supported for ERC-8004. Supported chains: ${ERC8004_SUPPORTED_CHAINS.join(', ')}`
    );
  }
  return ERC8004_ADDRESSES[chainId as ERC8004ChainId];
}

/**
 * Check if a chain ID is supported for ERC-8004
 *
 * @param chainId - The chain ID to check
 * @returns True if the chain is supported
 */
export function isERC8004SupportedChain(
  chainId: number
): chainId is ERC8004ChainId {
  return ERC8004_SUPPORTED_CHAINS.includes(chainId as ERC8004ChainId);
}

/**
 * Check if ERC-8004 registries are deployed on a chain
 * (not all addresses are zero)
 *
 * @param chainId - The chain ID to check
 * @returns True if registries are deployed
 */
export function isERC8004Deployed(chainId: number): boolean {
  if (!isERC8004SupportedChain(chainId)) {
    return false;
  }

  const addresses = ERC8004_ADDRESSES[chainId as ERC8004ChainId];
  const zeroAddress = '0x0000000000000000000000000000000000000000';

  return (
    addresses.identityRegistry !== zeroAddress &&
    addresses.reputationRegistry !== zeroAddress &&
    addresses.validationRegistry !== zeroAddress
  );
}

/**
 * Format a global agent identifier per ERC-8004 spec
 * Format: eip155:{chainId}:{registryAddress}
 *
 * @param chainId - The chain ID
 * @param registryAddress - The identity registry address
 * @returns Global agent identifier string
 */
export function formatGlobalAgentId(
  chainId: number,
  registryAddress: string
): string {
  return `eip155:${chainId}:${registryAddress.toLowerCase()}`;
}

/**
 * Parse a global agent identifier
 *
 * @param globalId - The global agent identifier string
 * @returns Parsed components or null if invalid
 */
export function parseGlobalAgentId(globalId: string): {
  namespace: string;
  chainId: number;
  registryAddress: string;
} | null {
  const match = globalId.match(/^(\w+):(\d+):(.+)$/);
  if (!match) {
    return null;
  }

  return {
    namespace: match[1],
    chainId: parseInt(match[2], 10),
    registryAddress: match[3],
  };
}

/**
 * Get block explorer URL for an ERC-8004 identity
 *
 * @param chainId - The chain ID
 * @param registryAddress - The registry contract address
 * @param tokenId - The NFT token ID
 * @returns Block explorer URL
 */
export function getERC8004ExplorerUrl(
  chainId: number,
  registryAddress: string,
  tokenId: bigint | number
): string {
  const baseUrl =
    chainId === base.id
      ? 'https://basescan.org'
      : 'https://sepolia.basescan.org';

  return `${baseUrl}/token/${registryAddress}?a=${tokenId}`;
}
