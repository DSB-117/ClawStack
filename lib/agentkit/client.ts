/**
 * Coinbase CDP Client Setup
 *
 * Provides wallet creation and management for Base (EVM) and Solana chains
 * using @coinbase/cdp-sdk directly (bypasses @coinbase/agentkit to avoid
 * ESM compatibility issues in Vercel's serverless runtime).
 */

import { CdpClient } from '@coinbase/cdp-sdk';

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
 * Get a configured CDP client instance
 */
export function getCdpClient(): CdpClient {
  validateEnvironment();
  return new CdpClient({
    apiKeyId: process.env.CDP_API_KEY_NAME!,
    apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    walletSecret: process.env.CDP_WALLET_SECRET!,
  });
}

/**
 * Create a new Base (EVM) account
 */
export async function createBaseAccount(
  idempotencyKey?: string
): Promise<{ address: string }> {
  const cdp = getCdpClient();
  console.log('Creating Base (EVM) account...');
  const account = await cdp.evm.createAccount({
    idempotencyKey,
  });
  console.log('Base account created:', account.address);
  return { address: account.address };
}

/**
 * Create a new Solana account
 */
export async function createSolanaAccount(
  idempotencyKey?: string
): Promise<{ address: string }> {
  const cdp = getCdpClient();
  console.log('Creating Solana account...');
  const account = await cdp.solana.createAccount({
    idempotencyKey,
  });
  console.log('Solana account created:', account.address);
  return { address: account.address };
}

/**
 * Send a transaction on Base (EVM)
 */
export async function sendBaseTransaction(
  fromAddress: string,
  to: string,
  data: string,
  value?: string
): Promise<{ transactionHash: string }> {
  const cdp = getCdpClient();
  const result = await cdp.evm.sendTransaction({
    address: fromAddress as `0x${string}`,
    transaction: {
      to: to as `0x${string}`,
      data: data as `0x${string}`,
      value: value ? BigInt(value) : undefined,
    },
    network: 'base',
  });
  return { transactionHash: result.transactionHash };
}

/**
 * Sign and send a transaction on Solana
 */
export async function sendSolanaTransaction(
  transactionBase64: string
): Promise<{ signature: string }> {
  const cdp = getCdpClient();
  const result = await cdp.solana.sendTransaction({
    transaction: transactionBase64,
    network: 'solana',
  });
  return { signature: result.signature };
}

/**
 * Get EVM token balances for an address
 */
export async function getEvmTokenBalances(address: string) {
  const cdp = getCdpClient();
  return cdp.evm.listTokenBalances({
    address: address as `0x${string}`,
    network: 'base',
  });
}

/**
 * Get Solana token balances for an address
 */
export async function getSolanaTokenBalances(address: string) {
  const cdp = getCdpClient();
  return cdp.solana.listTokenBalances({
    address,
    network: 'solana',
  });
}
