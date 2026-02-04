import {
  Connection,
  Commitment,
  Finality,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';

/**
 * Singleton connection instance for the primary RPC endpoint.
 */
let connection: Connection | null = null;

/**
 * Get the configured RPC endpoints in priority order.
 * Filters out undefined/empty values.
 */
function getRpcEndpoints(): string[] {
  return [
    process.env.SOLANA_RPC_URL,
    process.env.SOLANA_RPC_FALLBACK_URL,
    'https://api.mainnet-beta.solana.com', // Public fallback (rate-limited)
  ].filter((endpoint): endpoint is string => Boolean(endpoint));
}

/**
 * Get or create a singleton Solana connection.
 * Uses the primary RPC endpoint from environment variables.
 *
 * @param commitment - Transaction commitment level (default: 'confirmed')
 * @returns A Solana Connection instance
 */
export function getSolanaConnection(
  commitment: Commitment = 'confirmed'
): Connection {
  if (!connection) {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      throw new Error('SOLANA_RPC_URL environment variable is not set');
    }

    connection = new Connection(rpcUrl, {
      commitment,
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connection;
}

/**
 * Create a new connection to a specific endpoint.
 * Use this for one-off requests or when testing different endpoints.
 *
 * @param endpoint - RPC endpoint URL
 * @param commitment - Transaction commitment level
 * @returns A new Solana Connection instance
 */
export function createConnection(
  endpoint: string,
  commitment: Commitment = 'confirmed'
): Connection {
  return new Connection(endpoint, {
    commitment,
    confirmTransactionInitialTimeout: 60000,
  });
}

/**
 * Fetch a parsed transaction with automatic fallback to secondary RPC endpoints.
 * Tries each configured endpoint in order until one succeeds.
 *
 * @param signature - Transaction signature to fetch
 * @param finality - Transaction finality level (default: 'confirmed')
 * @returns The parsed transaction with metadata, or null if not found
 * @throws Error if all RPC endpoints fail
 */
export async function getTransactionWithFallback(
  signature: string,
  finality: Finality = 'confirmed'
): Promise<ParsedTransactionWithMeta | null> {
  const endpoints = getRpcEndpoints();

  if (endpoints.length === 0) {
    throw new Error('No Solana RPC endpoints configured');
  }

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const conn = createConnection(endpoint, finality);
      const tx = await conn.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: finality,
      });

      // Transaction found (or confirmed not to exist)
      return tx;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[Solana RPC] Endpoint ${endpoint} failed: ${lastError.message}, trying next...`
      );
    }
  }

  throw new Error(
    `All Solana RPC endpoints failed. Last error: ${lastError?.message}`
  );
}

/**
 * Check the health/latency of an RPC endpoint.
 * Useful for monitoring and endpoint selection.
 *
 * @param endpoint - RPC endpoint URL to check
 * @returns Object with latency in ms and slot number
 */
export async function checkEndpointHealth(
  endpoint: string
): Promise<{ latency: number; slot: number }> {
  const conn = createConnection(endpoint);
  const start = Date.now();
  const slot = await conn.getSlot();
  const latency = Date.now() - start;

  return { latency, slot };
}

/**
 * Reset the singleton connection.
 * Useful for testing or when changing RPC configuration.
 */
export function resetConnection(): void {
  connection = null;
}
