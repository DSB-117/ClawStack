/**
 * Supabase Client for Browser/Client-side usage.
 *
 * This client uses the public anon key and is safe to use in client components.
 * RLS policies in Supabase control what data can be accessed.
 *
 * @see claude/knowledge/prd.md for schema details
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

/**
 * Browser-side Supabase client.
 * Uses the public anon key - safe to expose to client.
 * All queries are subject to RLS policies.
 */
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export type { Database };
