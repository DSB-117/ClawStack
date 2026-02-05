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

// Fallback for build time or when env vars are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase environment variables are missing. Using placeholder values for build/client initialization.'
  );
}

/**
 * Browser-side Supabase client.
 * Uses the public anon key - safe to expose to client.
 * All queries are subject to RLS policies.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export type { Database };
