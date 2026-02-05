/**
 * ERC-8004 Verification Service
 *
 * Handles verification of ERC-8004 identities and tier upgrades.
 * Used by API endpoints to verify agent claims and update tiers.
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004
 */

import { verifyMessage } from 'viem';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import {
  verifyERC8004Identity,
  type ERC8004VerificationResult,
} from './client';
import { isERC8004SupportedChain, isERC8004Deployed } from './addresses';

// ============================================
// Types
// ============================================

/**
 * Request to link an ERC-8004 identity to a ClawStack agent
 */
export interface LinkERC8004Request {
  agentId: string;
  tokenId: bigint;
  chainId: number;
  walletAddress: `0x${string}`;
  signature: `0x${string}`;
  message: string;
}

/**
 * Result of linking an ERC-8004 identity
 */
export interface LinkERC8004Result {
  success: boolean;
  verified: boolean;
  tierUpgraded: boolean;
  newTier?: string;
  agentURI?: string;
  error?: string;
}

/**
 * Stored ERC-8004 link data
 */
export interface StoredERC8004Link {
  erc8004_token_id: number;
  erc8004_registry_address: string;
  erc8004_chain_id: number;
  erc8004_verified_at: string;
  erc8004_agent_uri: string | null;
}

// ============================================
// Constants
// ============================================

/**
 * Minimum reputation score to qualify for automatic tier upgrade
 * Score is on 0-100 scale
 */
export const MIN_REPUTATION_FOR_VERIFIED = 50;

/**
 * Message template for ERC-8004 identity linking
 */
export function getERC8004LinkMessage(
  agentId: string,
  tokenId: bigint,
  chainId: number,
  timestamp: number
): string {
  return `Link ERC-8004 Identity to ClawStack

Agent ID: ${agentId}
Token ID: ${tokenId}
Chain ID: ${chainId}
Timestamp: ${timestamp}

By signing this message, you confirm that you own the ERC-8004 identity and authorize ClawStack to link it to your agent account.`;
}

/**
 * Validate that a message matches the expected format
 */
export function validateLinkMessage(
  message: string,
  agentId: string,
  tokenId: bigint,
  chainId: number
): { valid: boolean; timestamp?: number; error?: string } {
  // Extract agent ID from message
  const agentMatch = message.match(/Agent ID: ([a-f0-9-]+)/i);
  if (!agentMatch || agentMatch[1] !== agentId) {
    return { valid: false, error: 'Agent ID mismatch in message' };
  }

  // Extract token ID
  const tokenMatch = message.match(/Token ID: (\d+)/);
  if (!tokenMatch || BigInt(tokenMatch[1]) !== tokenId) {
    return { valid: false, error: 'Token ID mismatch in message' };
  }

  // Extract chain ID
  const chainMatch = message.match(/Chain ID: (\d+)/);
  if (!chainMatch || parseInt(chainMatch[1], 10) !== chainId) {
    return { valid: false, error: 'Chain ID mismatch in message' };
  }

  // Extract and validate timestamp
  const timestampMatch = message.match(/Timestamp: (\d+)/);
  if (!timestampMatch) {
    return { valid: false, error: 'Missing timestamp in message' };
  }

  const timestamp = parseInt(timestampMatch[1], 10);
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 5 * 60; // 5 minutes

  if (now - timestamp > maxAge) {
    return { valid: false, error: 'Message expired (older than 5 minutes)' };
  }

  if (timestamp > now + 60) {
    return { valid: false, error: 'Message timestamp is in the future' };
  }

  return { valid: true, timestamp };
}

// ============================================
// Verification Functions
// ============================================

/**
 * Verify a signature for ERC-8004 identity linking
 *
 * @param message - The signed message
 * @param signature - The signature
 * @param expectedAddress - The expected signer address
 * @returns True if signature is valid
 */
export async function verifyERC8004Signature(
  message: string,
  signature: `0x${string}`,
  expectedAddress: `0x${string}`
): Promise<boolean> {
  try {
    const valid = await verifyMessage({
      address: expectedAddress,
      message,
      signature,
    });
    return valid;
  } catch {
    return false;
  }
}

/**
 * Link an ERC-8004 identity to a ClawStack agent
 *
 * Steps:
 * 1. Validate chain is supported
 * 2. Verify signature
 * 3. Validate message content
 * 4. Verify on-chain ownership
 * 5. Update database
 * 6. Upgrade tier if eligible
 *
 * @param request - Link request details
 * @returns Result of the linking operation
 */
export async function linkERC8004Identity(
  request: LinkERC8004Request
): Promise<LinkERC8004Result> {
  const { agentId, tokenId, chainId, walletAddress, signature, message } =
    request;

  // 1. Validate chain is supported
  if (!isERC8004SupportedChain(chainId)) {
    return {
      success: false,
      verified: false,
      tierUpgraded: false,
      error: `Chain ${chainId} is not supported for ERC-8004`,
    };
  }

  // Check if registries are deployed
  if (!isERC8004Deployed(chainId)) {
    return {
      success: false,
      verified: false,
      tierUpgraded: false,
      error: `ERC-8004 registries not deployed on chain ${chainId}`,
    };
  }

  // 2. Verify signature
  const sigValid = await verifyERC8004Signature(
    message,
    signature,
    walletAddress
  );
  if (!sigValid) {
    return {
      success: false,
      verified: false,
      tierUpgraded: false,
      error: 'Invalid signature',
    };
  }

  // 3. Validate message content
  const messageValidation = validateLinkMessage(
    message,
    agentId,
    tokenId,
    chainId
  );
  if (!messageValidation.valid) {
    return {
      success: false,
      verified: false,
      tierUpgraded: false,
      error: messageValidation.error,
    };
  }

  // 4. Verify on-chain ownership
  let verificationResult: ERC8004VerificationResult;
  try {
    verificationResult = await verifyERC8004Identity(
      tokenId,
      walletAddress,
      chainId,
      true // Include reputation
    );
  } catch (error) {
    return {
      success: false,
      verified: false,
      tierUpgraded: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }

  if (!verificationResult.verified) {
    return {
      success: false,
      verified: false,
      tierUpgraded: false,
      error: verificationResult.error || 'On-chain verification failed',
    };
  }

  // 5. Update database
  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from('agents')
    .update({
      erc8004_token_id: Number(tokenId),
      erc8004_registry_address: verificationResult.registryAddress,
      erc8004_chain_id: chainId,
      erc8004_verified_at: now,
      erc8004_agent_uri: verificationResult.agentURI || null,
      // Also update wallet_base if not already set
      wallet_base: walletAddress,
    })
    .eq('id', agentId);

  if (updateError) {
    console.error('Failed to update agent with ERC-8004 data:', updateError);
    return {
      success: false,
      verified: true,
      tierUpgraded: false,
      error: 'Failed to save ERC-8004 link to database',
    };
  }

  // 6. Check if eligible for tier upgrade
  let tierUpgraded = false;
  let newTier: string | undefined;

  // Upgrade to 'verified' tier if:
  // - Agent is currently 'new' or 'established'
  // - Has valid ERC-8004 identity
  // - (Optional) Has minimum reputation score
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('reputation_tier')
    .eq('id', agentId)
    .single();

  if (agent && ['new', 'established'].includes(agent.reputation_tier)) {
    // Check reputation threshold (if reputation data available)
    const hasMinReputation =
      !verificationResult.reputation ||
      verificationResult.reputation.normalizedScore >= MIN_REPUTATION_FOR_VERIFIED;

    if (hasMinReputation) {
      const { error: tierError } = await supabaseAdmin
        .from('agents')
        .update({ reputation_tier: 'verified' })
        .eq('id', agentId);

      if (!tierError) {
        tierUpgraded = true;
        newTier = 'verified';
      }
    }
  }

  return {
    success: true,
    verified: true,
    tierUpgraded,
    newTier,
    agentURI: verificationResult.agentURI,
  };
}

/**
 * Unlink an ERC-8004 identity from a ClawStack agent
 *
 * Note: This does NOT automatically downgrade the tier.
 * Tier changes are manual operations.
 *
 * @param agentId - The agent ID to unlink
 * @returns Success status
 */
export async function unlinkERC8004Identity(agentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const { error } = await supabaseAdmin
    .from('agents')
    .update({
      erc8004_token_id: null,
      erc8004_registry_address: null,
      erc8004_chain_id: null,
      erc8004_verified_at: null,
      erc8004_agent_uri: null,
    })
    .eq('id', agentId);

  if (error) {
    return {
      success: false,
      error: 'Failed to unlink ERC-8004 identity',
    };
  }

  return { success: true };
}

/**
 * Get the ERC-8004 link status for an agent
 *
 * @param agentId - The agent ID to check
 * @returns Link status or null if not linked
 */
export async function getERC8004LinkStatus(
  agentId: string
): Promise<StoredERC8004Link | null> {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select(
      'erc8004_token_id, erc8004_registry_address, erc8004_chain_id, erc8004_verified_at, erc8004_agent_uri'
    )
    .eq('id', agentId)
    .single();

  if (error || !data || !data.erc8004_token_id) {
    return null;
  }

  return data as StoredERC8004Link;
}

/**
 * Re-verify an existing ERC-8004 link
 *
 * Checks that the agent's wallet still owns the linked token.
 * Should be called periodically or before important operations.
 *
 * @param agentId - The agent ID to re-verify
 * @returns Verification result
 */
export async function reverifyERC8004Link(agentId: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  // Get current link data
  const { data: agent, error: fetchError } = await supabaseAdmin
    .from('agents')
    .select(
      'erc8004_token_id, erc8004_chain_id, wallet_base'
    )
    .eq('id', agentId)
    .single();

  if (fetchError || !agent) {
    return { valid: false, error: 'Agent not found' };
  }

  if (!agent.erc8004_token_id || !agent.erc8004_chain_id) {
    return { valid: false, error: 'No ERC-8004 identity linked' };
  }

  if (!agent.wallet_base) {
    return { valid: false, error: 'No wallet address on record' };
  }

  // Verify on-chain ownership
  try {
    const result = await verifyERC8004Identity(
      BigInt(agent.erc8004_token_id),
      agent.wallet_base as `0x${string}`,
      agent.erc8004_chain_id,
      false // Skip reputation for re-verification
    );

    if (!result.verified) {
      // Ownership changed - unlink the identity
      await unlinkERC8004Identity(agentId);
      return {
        valid: false,
        error: result.error || 'Ownership verification failed',
      };
    }

    // Update verification timestamp
    await supabaseAdmin
      .from('agents')
      .update({ erc8004_verified_at: new Date().toISOString() })
      .eq('id', agentId);

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}
