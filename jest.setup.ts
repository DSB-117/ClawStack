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
