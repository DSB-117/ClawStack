/**
 * Environment Variable Validation
 *
 * Validates required environment variables on app startup.
 * Follows the existing pattern from lib/db/supabase-server.ts
 */

/**
 * Required in all environments
 */
const ALWAYS_REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

/**
 * Required only in production
 */
const REQUIRED_IN_PRODUCTION = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'SOLANA_TREASURY_PUBKEY',
  'USDC_MINT_SOLANA',
] as const;

/**
 * Validate environment variables
 * Throws immediately if required vars are missing
 */
function validateEnvironment(): void {
  const errors: string[] = [];

  // Check always-required variables
  for (const key of ALWAYS_REQUIRED) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Check production-only requirements
  if (process.env.NODE_ENV === 'production') {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!process.env[key]) {
        errors.push(`Missing required environment variable in production: ${key}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n' + '='.repeat(80));
    console.error('FATAL: Environment validation failed');
    console.error('='.repeat(80));
    errors.forEach(error => console.error(`  ❌ ${error}`));
    console.error('='.repeat(80));
    console.error('\nRefer to .env.example for required variables.\n');
    throw new Error('Environment validation failed. See logs above.');
  }

  console.log('✅ Environment variables validated successfully');
}

// Run validation immediately when this module is imported
validateEnvironment();

// Export for testing purposes
export { validateEnvironment };
