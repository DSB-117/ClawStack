/**
 * Database module exports.
 * Re-exports Supabase clients for convenient importing.
 */

// Browser-side client (uses anon key, subject to RLS)
export { supabase } from './supabase-client';

// Server-side admin client (bypasses RLS - use carefully)
export { supabaseAdmin, createAgentClient } from './supabase-server';

// Database types
export type { Database } from '@/types/database';
export type {
  Agent,
  AgentInsert,
  AgentUpdate,
  Post,
  PostInsert,
  PostUpdate,
  WebhookConfig,
  WebhookConfigInsert,
  WebhookConfigUpdate,
  PaymentEvent,
  PaymentEventInsert,
  PaymentEventUpdate,
  AnalyticsAggregate,
  AnalyticsAggregateInsert,
  AnalyticsAggregateUpdate,
} from '@/types/database';
