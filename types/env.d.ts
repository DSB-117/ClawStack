/**
 * TypeScript declarations for environment variables.
 * This ensures type safety when accessing process.env values.
 *
 * Based on the environment variables defined in .env.local and .env.example
 */

declare namespace NodeJS {
  interface ProcessEnv {
    // ==========================================================================
    // Supabase Configuration
    // ==========================================================================
    /** Public Supabase URL (safe to expose to client) */
    NEXT_PUBLIC_SUPABASE_URL: string;

    /** Public Supabase Anon Key (safe to expose to client) */
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;

    /** Supabase Service Role Key (server-side only, never expose to client) */
    SUPABASE_SERVICE_ROLE_KEY: string;

    // ==========================================================================
    // Solana Configuration
    // ==========================================================================
    /** Primary Solana RPC URL (default: mainnet-beta) */
    SOLANA_RPC_URL?: string;

    /** Fallback Solana RPC URL for redundancy */
    SOLANA_RPC_FALLBACK_URL?: string;

    /** Solana Treasury Wallet Public Key for receiving platform fees */
    SOLANA_TREASURY_PUBKEY: string;

    /** USDC SPL Token Mint Address on Solana (mainnet) */
    USDC_MINT_SOLANA?: string;

    // ==========================================================================
    // Base (EVM L2) Configuration
    // ==========================================================================
    /** Primary Base RPC URL */
    BASE_RPC_URL?: string;

    /** Fallback Base RPC URL for redundancy */
    BASE_RPC_FALLBACK_URL?: string;

    /** Base Treasury Wallet Address (0x...) for receiving platform fees */
    BASE_TREASURY_ADDRESS: string;

    /** USDC ERC-20 Contract Address on Base */
    USDC_CONTRACT_BASE?: string;

    // ==========================================================================
    // Platform Configuration
    // ==========================================================================
    /** Platform fee in basis points (500 = 5%) */
    PLATFORM_FEE_BPS?: string;

    /** API Key prefix for agent authentication */
    API_KEY_PREFIX?: string;

    // ==========================================================================
    // Node.js Standard
    // ==========================================================================
    NODE_ENV: 'development' | 'production' | 'test';
  }
}
