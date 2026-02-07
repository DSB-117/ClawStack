/**
 * AgentKit Wallet Service
 *
 * Handles wallet creation, address retrieval, balance checks, and USDC transfers
 * for agent wallets using Coinbase AgentKit.
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import { encryptWalletData } from './encryption';
import {
  createBaseWalletProvider,
  createSolanaWalletProvider,
  restoreBaseWalletProvider,
  restoreSolanaWalletProvider,
} from './client';
import { erc20ActionProvider, CdpSmartWalletProvider, CdpSolanaWalletProvider } from '@coinbase/agentkit';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// USDC contract addresses
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export interface AgentWalletInfo {
  walletId: string;
  solanaAddress: string;
  baseAddress: string;
  createdAt: string;
}

export interface WalletBalances {
  solana: string;
  base: string;
}

/**
 * Create wallets for a new agent
 * Creates both Solana and Base wallets and stores encrypted data
 */
export async function createAgentWallet(agentId: string): Promise<AgentWalletInfo> {
  // Use agent ID as idempotency key for deterministic wallet creation
  const idempotencyKey = `clawstack-agent-${agentId}`;

  // Create Base (EVM) wallet with gas-free transactions
  const baseProvider = await createBaseWalletProvider(idempotencyKey);
  const baseAddress = baseProvider.getAddress();
  const baseExport = await baseProvider.exportWallet();

  // Create Solana wallet
  const solanaProvider = await createSolanaWalletProvider(idempotencyKey);
  const solanaAddress = solanaProvider.getAddress();
  const solanaExport = await solanaProvider.exportWallet();

  // Store wallet data (encrypted)
  const walletData = {
    base: baseExport,
    solana: solanaExport,
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
      agentkit_wallet_address_solana: solanaAddress,
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
    solanaAddress,
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
 * Get the wallet providers for an agent (for transactions)
 */
async function getAgentWalletProviders(
  agentId: string
): Promise<{ base: CdpSmartWalletProvider; solana: CdpSolanaWalletProvider }> {
  const { data: agent, error } = await supabaseAdmin
    .from('agents')
    .select('agentkit_wallet_address_base, agentkit_wallet_address_solana, wallet_provider')
    .eq('id', agentId)
    .single();

  if (error || !agent) {
    throw new Error('Agent not found');
  }

  if (agent.wallet_provider !== 'agentkit') {
    throw new Error('Agent does not have AgentKit wallets');
  }

  if (!agent.agentkit_wallet_address_base || !agent.agentkit_wallet_address_solana) {
    throw new Error('Agent wallet addresses not found');
  }

  // Restore wallet providers using stored addresses
  const baseProvider = await restoreBaseWalletProvider(
    agent.agentkit_wallet_address_base as `0x${string}`
  );
  const solanaProvider = await restoreSolanaWalletProvider(
    agent.agentkit_wallet_address_solana
  );

  return { base: baseProvider, solana: solanaProvider };
}

/**
 * Get USDC balance on Base chain
 */
async function getBaseUSDCBalance(address: string): Promise<string> {
  try {
    const provider = await restoreBaseWalletProvider(address as `0x${string}`);
    const erc20Provider = erc20ActionProvider();

    const result = await erc20Provider.getBalance(provider, {
      tokenAddress: USDC_BASE,
    });

    // Parse the balance from the result string
    const match = result.match(/Balance: ([\d.]+)/);
    return match ? match[1] : '0';
  } catch (error) {
    console.error('Failed to get Base USDC balance:', error);
    return '0';
  }
}

/**
 * Get USDC balance on Solana chain
 */
async function getSolanaUSDCBalance(address: string): Promise<string> {
  try {
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
    );

    const publicKey = new PublicKey(address);
    const usdcMint = new PublicKey(USDC_SOLANA);

    // Get associated token account
    const tokenAccount = await getAssociatedTokenAddress(usdcMint, publicKey);

    try {
      const balance = await connection.getTokenAccountBalance(tokenAccount);
      return balance.value.uiAmountString || '0';
    } catch {
      // Token account might not exist yet (no USDC received)
      return '0';
    }
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
 * Transfer USDC on Base (gas-free via CDP Smart Wallet)
 */
async function transferBaseUSDC(
  agentId: string,
  destinationAddress: string,
  amountUsdc: string
): Promise<{ txHash: string; gasless: boolean }> {
  const { base: provider } = await getAgentWalletProviders(agentId);
  const erc20Provider = erc20ActionProvider();

  const result = await erc20Provider.transfer(provider, {
    tokenAddress: USDC_BASE,
    destinationAddress: destinationAddress,
    amount: amountUsdc,
  });

  // Parse transaction hash from result
  const match = result.match(/Transaction hash: (0x[a-fA-F0-9]+)/);
  const txHash = match ? match[1] : '';

  return { txHash, gasless: true };
}

/**
 * Transfer USDC on Solana (requires SOL for gas)
 */
async function transferSolanaUSDC(
  agentId: string,
  destinationAddress: string,
  amountUsdc: string
): Promise<{ signature: string; gasless: boolean }> {
  const { solana: provider } = await getAgentWalletProviders(agentId);

  // For Solana, we need to manually create and send the transfer transaction
  // This is more complex - using the SPL token program
  const connection = provider.getConnection();
  const fromPubkey = provider.getPublicKey();
  const toPubkey = new PublicKey(destinationAddress);
  const usdcMint = new PublicKey(USDC_SOLANA);

  // Get token accounts
  const fromTokenAccount = await getAssociatedTokenAddress(usdcMint, fromPubkey);
  const toTokenAccount = await getAssociatedTokenAddress(usdcMint, toPubkey);

  // Import SPL token for transfer instruction
  const { createTransferInstruction } = await import('@solana/spl-token');
  const { VersionedTransaction, TransactionMessage } = await import(
    '@solana/web3.js'
  );

  // Convert USDC amount to lamports (6 decimals)
  const amount = Math.floor(parseFloat(amountUsdc) * 1_000_000);

  // Create transfer instruction
  const transferIx = createTransferInstruction(
    fromTokenAccount,
    toTokenAccount,
    fromPubkey,
    amount
  );

  // Get latest blockhash
  const { blockhash } = await connection.getLatestBlockhash();

  // Create versioned transaction
  const messageV0 = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: blockhash,
    instructions: [transferIx],
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);

  // Sign and send
  const signature = await provider.signAndSendTransaction(transaction);

  // Wait for confirmation
  await provider.waitForSignatureResult(signature);

  return { signature, gasless: false };
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
