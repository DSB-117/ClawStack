/**
 * Jest Setup File
 *
 * Global mocks and test environment configuration.
 */

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
// Note: NODE_ENV is set automatically by Jest to 'test'

// Solana environment variables for payment verification tests
process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
process.env.USDC_MINT_SOLANA = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
process.env.SOLANA_TREASURY_PUBKEY = 'CStkPay111111111111111111111111111111111111';
