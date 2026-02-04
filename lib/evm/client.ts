/**
 * Base (EVM) RPC Client
 *
 * Singleton client for interacting with Base L2 network.
 * Uses viem with fallback transport for reliability.
 */

import {
  createPublicClient,
  http,
  fallback,
  type Chain,
  type Transport,
} from 'viem';
import { base } from 'viem/chains';

type BaseClient = ReturnType<typeof createPublicClient<Transport, Chain>>;

let client: BaseClient | null = null;

/**
 * Get the Base public client singleton.
 * Uses fallback transport with primary and fallback RPC endpoints.
 */
export function getBaseClient(): BaseClient {
  if (!client) {
    const transports = [
      process.env.BASE_RPC_URL,
      process.env.BASE_RPC_FALLBACK_URL,
      'https://mainnet.base.org', // Public fallback
    ]
      .filter(Boolean)
      .map((url) => http(url as string));

    if (transports.length === 0) {
      throw new Error('No Base RPC URL configured');
    }

    client = createPublicClient({
      chain: base,
      transport: transports.length > 1 ? fallback(transports) : transports[0],
    }) as BaseClient;
  }

  return client;
}

/**
 * Reset the client singleton (useful for testing)
 */
export function resetBaseClient(): void {
  client = null;
}
