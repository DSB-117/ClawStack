/**
 * Coinbase AgentKit Client Setup
 *
 * Provides wallet providers for Base (EVM) and Solana chains
 * using Coinbase Developer Platform infrastructure.
 */

import {
  CdpSmartWalletProvider,
  CdpSolanaWalletProvider,
} from '@coinbase/agentkit';

// Validate required environment variables
function validateEnvironment() {
  if (!process.env.CDP_API_KEY_NAME) {
    throw new Error('CDP_API_KEY_NAME environment variable is required');
  }
  if (!process.env.CDP_API_KEY_PRIVATE_KEY) {
    throw new Error('CDP_API_KEY_PRIVATE_KEY environment variable is required');
  }
  if (!process.env.CDP_WALLET_SECRET) {
    throw new Error('CDP_WALLET_SECRET environment variable is required (from Coinbase Developer Platform)');
  }
}

/**
 * Create a new Base (EVM) Smart Wallet with gas-free transactions
 * Uses CDP Smart Wallet API for gasless operations
 */
export async function createBaseWalletProvider(
  idempotencyKey?: string
): Promise<CdpSmartWalletProvider> {
  validateEnvironment();

  try {
    console.log('Initializing Base Wallet Provider...');
    const provider = await CdpSmartWalletProvider.configureWithWallet({
      apiKeyId: process.env.CDP_API_KEY_NAME,
      apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      walletSecret: process.env.CDP_WALLET_SECRET,
      networkId: 'base',
      idempotencyKey,
      rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    });
    console.log('Base Wallet Provider initialized successfully');
    return provider;
  } catch (error) {
    console.error('Failed to initialize Base Wallet Provider:', error);
    throw error;
  }
}

/**
 * Create a new Solana Wallet
 * Note: Solana transactions require SOL for gas fees
 */
export async function createSolanaWalletProvider(
  idempotencyKey?: string
): Promise<CdpSolanaWalletProvider> {
  validateEnvironment();

  const provider = await CdpSolanaWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_NAME,
    apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    walletSecret: process.env.CDP_WALLET_SECRET,
    networkId: 'solana-mainnet',
    idempotencyKey,
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  });

  return provider;
}

/**
 * Restore an existing Base wallet from stored address
 */
export async function restoreBaseWalletProvider(
  address: `0x${string}`
): Promise<CdpSmartWalletProvider> {
  validateEnvironment();

  const provider = await CdpSmartWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_NAME,
    apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    walletSecret: process.env.CDP_WALLET_SECRET,
    networkId: 'base',
    address,
  });

  return provider;
}

/**
 * Restore an existing Solana wallet from stored address
 */
export async function restoreSolanaWalletProvider(
  address: string
): Promise<CdpSolanaWalletProvider> {
  validateEnvironment();

  const provider = await CdpSolanaWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_NAME,
    apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    walletSecret: process.env.CDP_WALLET_SECRET,
    networkId: 'solana-mainnet',
    address: address as `0x${string}`,
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  });

  return provider;
}
