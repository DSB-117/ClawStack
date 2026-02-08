/**
 * ERC-8004 Client Functions
 *
 * Provides functions to interact with ERC-8004 registries:
 * - Identity verification (ownership checks)
 * - Metadata retrieval
 * - Reputation queries
 * - Validation status
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004
 */

import { createPublicClient, http, fallback, type Chain, type Transport } from 'viem';
import { mainnet, sepolia, base, baseSepolia } from 'viem/chains';
import {
  ERC8004_IDENTITY_REGISTRY_ABI,
  ERC8004_REPUTATION_REGISTRY_ABI,
} from './abi';
import {
  getERC8004Addresses,
  isERC8004SupportedChain,
  type ERC8004ChainId,
} from './addresses';

// ============================================
// Types
// ============================================

/**
 * Agent identity information from ERC-8004 registry
 */
export interface ERC8004AgentIdentity {
  tokenId: bigint;
  owner: `0x${string}`;
  agentURI: string;
  agentWallet: `0x${string}` | null;
}

/**
 * Reputation summary from ERC-8004 registry
 */
export interface ERC8004ReputationSummary {
  count: number;
  summaryValue: bigint;
  summaryValueDecimals: number;
  normalizedScore: number; // 0-100 scale
}

/**
 * Verification result for ERC-8004 identity
 */
export interface ERC8004VerificationResult {
  verified: boolean;
  tokenId: bigint;
  owner: `0x${string}`;
  agentURI: string;
  chainId: number;
  registryAddress: `0x${string}`;
  reputation?: ERC8004ReputationSummary;
  error?: string;
}

// ============================================
// Client Management
// ============================================

type ERC8004Client = ReturnType<typeof createPublicClient<Transport, Chain>>;

const clients: Map<ERC8004ChainId, ERC8004Client> = new Map();

/**
 * Get or create a public client for a specific chain
 *
 * @param chainId - The chain ID to get a client for
 * @returns Viem public client
 */
export function getERC8004Client(chainId: number): ERC8004Client {
  if (!isERC8004SupportedChain(chainId)) {
    throw new Error(`Chain ${chainId} is not supported for ERC-8004`);
  }

  const existingClient = clients.get(chainId);
  if (existingClient) {
    return existingClient;
  }

  const chainMap: Record<number, Chain> = {
    [mainnet.id]: mainnet,
    [sepolia.id]: sepolia,
    [base.id]: base,
    [baseSepolia.id]: baseSepolia,
  };
  const chain = chainMap[chainId];

  const rpcEnvKeys: Record<number, string> = {
    [mainnet.id]: 'ETH_RPC_URL',
    [sepolia.id]: 'ETH_SEPOLIA_RPC_URL',
    [base.id]: 'BASE_RPC_URL',
    [baseSepolia.id]: 'BASE_SEPOLIA_RPC_URL',
  };
  const rpcEnvKey = rpcEnvKeys[chainId];

  const fallbackEnvKeys: Record<number, string | undefined> = {
    [mainnet.id]: 'ETH_RPC_FALLBACK_URL',
    [sepolia.id]: undefined,
    [base.id]: 'BASE_RPC_FALLBACK_URL',
    [baseSepolia.id]: undefined,
  };
  const fallbackEnvKey = fallbackEnvKeys[chainId];

  const publicRpcs: Record<number, string> = {
    [mainnet.id]: 'https://eth.llamarpc.com',
    [sepolia.id]: 'https://rpc.sepolia.org',
    [base.id]: 'https://mainnet.base.org',
    [baseSepolia.id]: 'https://sepolia.base.org',
  };
  const publicRpc = publicRpcs[chainId];

  const transports = [
    process.env[rpcEnvKey],
    fallbackEnvKey ? process.env[fallbackEnvKey] : undefined,
    publicRpc,
  ]
    .filter(Boolean)
    .map((url) => http(url as string));

  const client = createPublicClient({
    chain,
    transport: transports.length > 1 ? fallback(transports) : transports[0],
  }) as ERC8004Client;

  clients.set(chainId, client);
  return client;
}

/**
 * Reset all clients (useful for testing)
 */
export function resetERC8004Clients(): void {
  clients.clear();
}

// ============================================
// Identity Registry Functions
// ============================================

/**
 * Get the owner of an ERC-8004 identity token
 *
 * @param tokenId - The token ID to check
 * @param chainId - The chain ID
 * @returns The owner address
 * @throws Error if token doesn't exist
 */
export async function getERC8004Owner(
  tokenId: bigint,
  chainId: number
): Promise<`0x${string}`> {
  const client = getERC8004Client(chainId);
  const addresses = getERC8004Addresses(chainId);

  const owner = await client.readContract({
    address: addresses.identityRegistry,
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'ownerOf',
    args: [tokenId],
  });

  return owner as `0x${string}`;
}

/**
 * Get the agent URI for an ERC-8004 identity
 *
 * @param tokenId - The token ID
 * @param chainId - The chain ID
 * @returns The agent URI
 */
export async function getERC8004AgentURI(
  tokenId: bigint,
  chainId: number
): Promise<string> {
  const client = getERC8004Client(chainId);
  const addresses = getERC8004Addresses(chainId);

  const uri = await client.readContract({
    address: addresses.identityRegistry,
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'tokenURI',
    args: [tokenId],
  });

  return uri as string;
}

/**
 * Get the agent wallet (if set) for an ERC-8004 identity
 *
 * @param tokenId - The token ID
 * @param chainId - The chain ID
 * @returns The agent wallet address or null if not set
 */
export async function getERC8004AgentWallet(
  tokenId: bigint,
  chainId: number
): Promise<`0x${string}` | null> {
  const client = getERC8004Client(chainId);
  const addresses = getERC8004Addresses(chainId);

  try {
    const wallet = await client.readContract({
      address: addresses.identityRegistry,
      abi: ERC8004_IDENTITY_REGISTRY_ABI,
      functionName: 'getAgentWallet',
      args: [tokenId],
    });

    const walletAddress = wallet as `0x${string}`;
    // Zero address means no wallet is set
    if (walletAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    return walletAddress;
  } catch {
    // Function may not exist or revert if no wallet set
    return null;
  }
}

/**
 * Get all tokens owned by an address
 *
 * @param owner - The owner address
 * @param chainId - The chain ID
 * @returns Array of token IDs owned
 */
export async function getERC8004TokensByOwner(
  owner: `0x${string}`,
  chainId: number
): Promise<bigint[]> {
  const client = getERC8004Client(chainId);
  const addresses = getERC8004Addresses(chainId);

  // Get balance first
  const balance = await client.readContract({
    address: addresses.identityRegistry,
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'balanceOf',
    args: [owner],
  });

  const tokenCount = Number(balance);
  if (tokenCount === 0) {
    return [];
  }

  // Get each token by index
  const tokens: bigint[] = [];
  for (let i = 0; i < tokenCount; i++) {
    try {
      const tokenId = await client.readContract({
        address: addresses.identityRegistry,
        abi: ERC8004_IDENTITY_REGISTRY_ABI,
        functionName: 'tokenOfOwnerByIndex',
        args: [owner, BigInt(i)],
      });
      tokens.push(tokenId as bigint);
    } catch {
      // tokenOfOwnerByIndex may not be supported
      break;
    }
  }

  return tokens;
}

// ============================================
// Reputation Registry Functions
// ============================================

/**
 * Get the reputation summary for an ERC-8004 agent
 *
 * @param tokenId - The agent token ID
 * @param chainId - The chain ID
 * @param tags - Optional filter by tags
 * @returns Reputation summary
 */
export async function getERC8004ReputationSummary(
  tokenId: bigint,
  chainId: number,
  tags?: { tag1?: string; tag2?: string }
): Promise<ERC8004ReputationSummary | null> {
  const client = getERC8004Client(chainId);
  const addresses = getERC8004Addresses(chainId);

  try {
    const [count, summaryValue, summaryValueDecimals] = (await client.readContract({
      address: addresses.reputationRegistry,
      abi: ERC8004_REPUTATION_REGISTRY_ABI,
      functionName: 'getSummary',
      args: [tokenId, [], tags?.tag1 || '', tags?.tag2 || ''],
    })) as [bigint, bigint, number];

    const feedbackCount = Number(count);
    if (feedbackCount === 0) {
      return {
        count: 0,
        summaryValue: 0n,
        summaryValueDecimals: 0,
        normalizedScore: 50, // Neutral score for no feedback
      };
    }

    // Normalize to 0-100 scale
    // Assuming summaryValue is a percentage (0-100) with decimals
    const divisor = BigInt(10 ** summaryValueDecimals);
    const normalizedScore = Math.min(
      100,
      Math.max(0, Number((summaryValue * 100n) / divisor) / feedbackCount)
    );

    return {
      count: feedbackCount,
      summaryValue,
      summaryValueDecimals,
      normalizedScore,
    };
  } catch {
    // Reputation registry may not be deployed or agent has no reputation
    return null;
  }
}

// ============================================
// Verification Functions
// ============================================

/**
 * Verify that an address owns a specific ERC-8004 identity
 *
 * @param tokenId - The token ID to verify
 * @param walletAddress - The wallet address claiming ownership
 * @param chainId - The chain ID
 * @returns True if the wallet owns the token
 */
export async function verifyERC8004Ownership(
  tokenId: bigint,
  walletAddress: `0x${string}`,
  chainId: number
): Promise<boolean> {
  try {
    const owner = await getERC8004Owner(tokenId, chainId);
    return owner.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Check if an ERC-8004 identity is valid (exists and is active)
 *
 * @param tokenId - The token ID to check
 * @param chainId - The chain ID
 * @returns True if the identity is valid
 */
export async function isValidERC8004Identity(
  tokenId: bigint,
  chainId: number
): Promise<boolean> {
  try {
    // Try to get owner - will revert if token doesn't exist
    await getERC8004Owner(tokenId, chainId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Comprehensive ERC-8004 identity verification
 *
 * Verifies ownership, fetches metadata, and optionally retrieves reputation.
 *
 * @param tokenId - The token ID to verify
 * @param walletAddress - The wallet address claiming ownership
 * @param chainId - The chain ID
 * @param includeReputation - Whether to fetch reputation data
 * @returns Verification result with all available data
 */
export async function verifyERC8004Identity(
  tokenId: bigint,
  walletAddress: `0x${string}`,
  chainId: number,
  includeReputation = true
): Promise<ERC8004VerificationResult> {
  const addresses = getERC8004Addresses(chainId);

  try {
    // Verify ownership
    const owner = await getERC8004Owner(tokenId, chainId);
    const isOwner = owner.toLowerCase() === walletAddress.toLowerCase();

    if (!isOwner) {
      return {
        verified: false,
        tokenId,
        owner,
        agentURI: '',
        chainId,
        registryAddress: addresses.identityRegistry,
        error: `Wallet ${walletAddress} does not own token ${tokenId}. Owner is ${owner}`,
      };
    }

    // Fetch agent URI
    const agentURI = await getERC8004AgentURI(tokenId, chainId);

    // Optionally fetch reputation
    let reputation: ERC8004ReputationSummary | undefined;
    if (includeReputation) {
      const rep = await getERC8004ReputationSummary(tokenId, chainId);
      if (rep) {
        reputation = rep;
      }
    }

    return {
      verified: true,
      tokenId,
      owner,
      agentURI,
      chainId,
      registryAddress: addresses.identityRegistry,
      reputation,
    };
  } catch (error) {
    return {
      verified: false,
      tokenId,
      owner: '0x0000000000000000000000000000000000000000',
      agentURI: '',
      chainId,
      registryAddress: addresses.identityRegistry,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to verify ERC-8004 identity',
    };
  }
}

/**
 * Get full agent identity information
 *
 * @param tokenId - The token ID
 * @param chainId - The chain ID
 * @returns Agent identity information
 */
export async function getERC8004AgentIdentity(
  tokenId: bigint,
  chainId: number
): Promise<ERC8004AgentIdentity> {
  const [owner, agentURI, agentWallet] = await Promise.all([
    getERC8004Owner(tokenId, chainId),
    getERC8004AgentURI(tokenId, chainId),
    getERC8004AgentWallet(tokenId, chainId),
  ]);

  return {
    tokenId,
    owner,
    agentURI,
    agentWallet,
  };
}
