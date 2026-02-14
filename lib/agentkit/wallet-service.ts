/**
 * CDP Wallet Service
 *
 * Handles wallet creation, address retrieval, balance checks, and USDC transfers
 * for agent wallets using @coinbase/cdp-sdk directly.
 *
 * NOTE: This intentionally does NOT use @coinbase/agentkit because that package
 * has ESM-only transitive dependencies that break in Vercel's serverless runtime.
 */

import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { encryptWalletData } from './encryption';
import {
  createBaseAccount,
  getCdpClient,
} from './client';

// USDC contract addresses
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export interface AgentWalletInfo {
  walletId: string;
  baseAddress: string;
  createdAt: string;
}

export interface WalletBalances {
  solana: string;
  base: string;
}

/**
 * Generate a deterministic UUID v4 based on a seed string
 * This ensures we always get the same UUID for the same input
 */
function generateDeterministicUUID(seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex');
  // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16), // Version 4
    ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20), // Variant 10xx
    hash.substring(20, 32),
  ].join('-');
}

/**
 * Create a Base wallet for a new agent
 */
export async function createAgentWallet(agentId: string): Promise<AgentWalletInfo> {
  // Use agent ID as seed for deterministic wallet creation
  const baseIdempotencyKey = generateDeterministicUUID(`base-${agentId}`);

  // Create Base (EVM) account
  const baseAccount = await createBaseAccount(baseIdempotencyKey);
  const baseAddress = baseAccount.address;

  // Store wallet data (encrypted)
  const walletData = {
    base: { address: baseAddress },
  };
  const encryptedWalletData = encryptWalletData(JSON.stringify(walletData));

  // Generate a unique wallet ID
  const walletId = `agentkit_${agentId.slice(0, 8)}`;

  // Update agent record with wallet info
  const { error } = await supabaseAdmin
    .from('agents')
    .update({
      agentkit_wallet_id: walletId,
      agentkit_seed_encrypted: encryptedWalletData,
      agentkit_wallet_address_base: baseAddress,
      agentkit_wallet_created_at: new Date().toISOString(),
      wallet_provider: 'agentkit',
    })
    .eq('id', agentId);

  if (error) {
    console.error('Failed to store wallet info:', error);
    throw new Error('Failed to store wallet information');
  }

  return {
    walletId,
    baseAddress,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get wallet addresses for an agent
 */
export async function getAgentWalletAddresses(agentId: string) {
  const { data: agent, error } = await supabaseAdmin
    .from('agents')
    .select(
      'agentkit_wallet_address_solana, agentkit_wallet_address_base, wallet_solana, wallet_base, wallet_provider'
    )
    .eq('id', agentId)
    .single();

  if (error || !agent) {
    throw new Error('Agent not found');
  }

  // Return AgentKit wallets if available, otherwise fall back to self-custodied
  return {
    solana: agent.agentkit_wallet_address_solana || agent.wallet_solana,
    base: agent.agentkit_wallet_address_base || agent.wallet_base,
    provider: agent.wallet_provider as 'agentkit' | 'self_custodied' | null,
  };
}

/**
 * Get USDC balance on Base chain using CDP SDK
 */
async function getBaseUSDCBalance(address: string): Promise<string> {
  try {
    const cdp = getCdpClient();
    const balances = await cdp.evm.listTokenBalances({
      address: address as `0x${string}`,
      network: 'base',
    });

    // Find USDC in the token list
    for (const token of balances.balances || []) {
      const tokenInfo = token.token as unknown as Record<string, unknown> | undefined;
      if (String(tokenInfo?.contractAddress || '').toLowerCase() === USDC_BASE.toLowerCase()) {
        const amount = parseFloat(String(token.amount ?? '0')) / 1e6;
        return amount.toFixed(2);
      }
    }
    return '0';
  } catch (error) {
    console.error('Failed to get Base USDC balance:', error);
    return '0';
  }
}

/**
 * Get USDC balance on Solana chain using CDP SDK
 */
async function getSolanaUSDCBalance(address: string): Promise<string> {
  try {
    const cdp = getCdpClient();
    const balances = await cdp.solana.listTokenBalances({
      address,
      network: 'solana',
    });

    // Find USDC in the token list
    for (const token of balances.balances || []) {
      const tokenInfo = token.token as unknown as Record<string, unknown> | undefined;
      if (String(tokenInfo?.mint || '') === USDC_SOLANA) {
        const amount = parseFloat(String(token.amount ?? '0')) / 1e6;
        return amount.toFixed(2);
      }
    }
    return '0';
  } catch (error) {
    console.error('Failed to get Solana USDC balance:', error);
    return '0';
  }
}

/**
 * Get USDC balance on both chains for an agent
 */
export async function getAgentUSDCBalance(agentId: string): Promise<WalletBalances> {
  const addresses = await getAgentWalletAddresses(agentId);

  if (addresses.provider !== 'agentkit') {
    throw new Error('Balance check only available for AgentKit wallets');
  }

  const [solanaBalance, baseBalance] = await Promise.all([
    addresses.solana ? getSolanaUSDCBalance(addresses.solana) : Promise.resolve('0'),
    addresses.base ? getBaseUSDCBalance(addresses.base) : Promise.resolve('0'),
  ]);

  return {
    solana: solanaBalance,
    base: baseBalance,
  };
}

/**
 * Transfer USDC on Base using CDP SDK
 */
async function transferBaseUSDC(
  agentId: string,
  destinationAddress: string,
  amountUsdc: string
): Promise<{ txHash: string; gasless: boolean }> {
  const addresses = await getAgentWalletAddresses(agentId);
  if (!addresses.base) throw new Error('No Base wallet address found');

  const cdp = getCdpClient();

  // ERC-20 transfer function selector + encoded params
  const amount = BigInt(Math.floor(parseFloat(amountUsdc) * 1e6));
  const paddedTo = destinationAddress.slice(2).padStart(64, '0');
  const paddedAmount = amount.toString(16).padStart(64, '0');
  const data = `0xa9059cbb${paddedTo}${paddedAmount}`;

  const result = await cdp.evm.sendTransaction({
    address: addresses.base as `0x${string}`,
    transaction: {
      to: USDC_BASE as `0x${string}`,
      data: data as `0x${string}`,
      value: BigInt(0),
    },
    network: 'base',
  });

  return { txHash: result.transactionHash, gasless: true };
}

/**
 * Transfer USDC on Solana using CDP SDK
 */
async function transferSolanaUSDC(
  _agentId: string,
  _destinationAddress: string,
  _amountUsdc: string
): Promise<{ signature: string; gasless: boolean }> {
  // Solana USDC transfers require building SPL token instructions
  // For now, this is a placeholder — full implementation requires
  // building the transaction client-side and sending via CDP SDK
  throw new Error(
    'Solana USDC transfers via CDP SDK are not yet implemented. ' +
    'Please use Base chain for transfers.'
  );
}

/**
 * Transfer USDC from agent wallet to external address
 * Base transfers are gas-free via CDP Smart Wallet
 * Solana transfers require small SOL fee (~$0.0001)
 */
export async function transferUSDC(
  agentId: string,
  chain: 'solana' | 'base',
  destinationAddress: string,
  amountUsdc: string
): Promise<{
  transactionId: string;
  status: string;
  chain: string;
  gasless: boolean;
}> {
  if (chain === 'base') {
    const result = await transferBaseUSDC(agentId, destinationAddress, amountUsdc);
    return {
      transactionId: result.txHash,
      status: 'COMPLETED',
      chain: 'base',
      gasless: result.gasless,
    };
  } else {
    const result = await transferSolanaUSDC(agentId, destinationAddress, amountUsdc);
    return {
      transactionId: result.signature,
      status: 'COMPLETED',
      chain: 'solana',
      gasless: result.gasless,
    };
  }
}
