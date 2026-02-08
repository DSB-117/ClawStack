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

/**
 * Lazily-initialised Supabase admin client singleton.
 * Defers env-var validation to first use so the build can compile
 * without runtime secrets (they are only needed at request time).
 */
let _supabaseAdmin: SupabaseClient<Database> | null = null;

function getSupabaseAdmin(): SupabaseClient<Database> {
  if (_supabaseAdmin) return _supabaseAdmin;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  _supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  return _supabaseAdmin;
}

/**
 * Server-side Supabase admin client.
 * Uses the service role key - NEVER expose to client.
 * Bypasses RLS - use with caution.
 *
 * Implemented as a Proxy so existing code can use `supabaseAdmin.from(...)` etc.
 * without any changes. The real client is created on first property access.
 */
export const supabaseAdmin: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, prop, receiver) {
      const client = getSupabaseAdmin();
      const value = Reflect.get(client, prop, receiver);
      return typeof value === 'function' ? value.bind(client) : value;
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
