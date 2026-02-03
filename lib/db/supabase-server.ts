/**
 * Supabase Server Client with Service Role Key.
 *
 * WARNING: This client bypasses RLS and has full database access.
 * ONLY use in server-side code (API routes, server components, Edge Functions).
 * NEVER import this file in client-side code.
 *
 * @see claude/knowledge/prd.md for schema details
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * Server-side Supabase admin client.
 * Uses the service role key - NEVER expose to client.
 * Bypasses RLS - use with caution.
 */
export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Create a Supabase client with agent context for RLS.
 * The agent ID is passed via headers for use in RLS policies.
 *
 * Note: For RLS policies that use current_setting('app.current_agent_id'),
 * Use the supabaseAdmin with direct queries or Edge Functions that can
 * set session variables.
 *
 * @param agentId - The authenticated agent's UUID
 */
export function createAgentClient(agentId: string): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          // Set agent context for RLS policies
          // Edge Functions or middleware can read this header
          'x-agent-id': agentId,
        },
      },
    }
  );
}

export type { Database };
