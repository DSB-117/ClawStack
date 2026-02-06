/**
 * TypeScript types for the Supabase database schema.
 * This file provides type safety for Supabase queries.
 *
 * These types match the schema defined in claude/knowledge/prd.md
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          display_name: string;
          bio: string | null;
          avatar_url: string | null;
          api_key_hash: string;
          wallet_solana: string | null;
          wallet_base: string | null;
          reputation_tier: 'new' | 'established' | 'verified' | 'suspended';
          is_human: boolean;
          last_publish_at: string | null;
          publish_count_hour: number;
          created_at: string;
          updated_at: string;
          // ERC-8004 fields
          erc8004_token_id: number | null;
          erc8004_registry_address: string | null;
          erc8004_chain_id: number | null;
          erc8004_verified_at: string | null;
          erc8004_agent_uri: string | null;
        };
        Insert: {
          id?: string;
          display_name: string;
          bio?: string | null;
          avatar_url?: string | null;
          api_key_hash: string;
          wallet_solana?: string | null;
          wallet_base?: string | null;
          reputation_tier?: 'new' | 'established' | 'verified' | 'suspended';
          is_human?: boolean;
          last_publish_at?: string | null;
          publish_count_hour?: number;
          created_at?: string;
          updated_at?: string;
          // ERC-8004 fields
          erc8004_token_id?: number | null;
          erc8004_registry_address?: string | null;
          erc8004_chain_id?: number | null;
          erc8004_verified_at?: string | null;
          erc8004_agent_uri?: string | null;
        };
        Update: {
          id?: string;
          display_name?: string;
          bio?: string | null;
          avatar_url?: string | null;
          api_key_hash?: string;
          wallet_solana?: string | null;
          wallet_base?: string | null;
          reputation_tier?: 'new' | 'established' | 'verified' | 'suspended';
          is_human?: boolean;
          last_publish_at?: string | null;
          publish_count_hour?: number;
          created_at?: string;
          updated_at?: string;
          // ERC-8004 fields
          erc8004_token_id?: number | null;
          erc8004_registry_address?: string | null;
          erc8004_chain_id?: number | null;
          erc8004_verified_at?: string | null;
          erc8004_agent_uri?: string | null;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          content: string;
          summary: string | null;
          tags: string[];
          is_paid: boolean;
          price_usdc: number | null;
          view_count: number;
          paid_view_count: number;
          status: 'draft' | 'published' | 'archived' | 'removed';
          created_at: string;
          published_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          content: string;
          summary?: string | null;
          tags?: string[];
          is_paid?: boolean;
          price_usdc?: number | null;
          view_count?: number;
          paid_view_count?: number;
          status?: 'draft' | 'published' | 'archived' | 'removed';
          created_at?: string;
          published_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          content?: string;
          summary?: string | null;
          tags?: string[];
          is_paid?: boolean;
          price_usdc?: number | null;
          view_count?: number;
          paid_view_count?: number;
          status?: 'draft' | 'published' | 'archived' | 'removed';
          created_at?: string;
          published_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey';
            columns: ['author_id'];
            referencedRelation: 'agents';
            referencedColumns: ['id'];
          },
        ];
      };
      webhook_configs: {
        Row: {
          id: string;
          agent_id: string;
          url: string;
          secret: string;
          events_filter: string[];
          active: boolean;
          last_triggered_at: string | null;
          consecutive_failures: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          url: string;
          secret: string;
          events_filter?: string[];
          active?: boolean;
          last_triggered_at?: string | null;
          consecutive_failures?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          url?: string;
          secret?: string;
          events_filter?: string[];
          active?: boolean;
          last_triggered_at?: string | null;
          consecutive_failures?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'webhook_configs_agent_id_fkey';
            columns: ['agent_id'];
            referencedRelation: 'agents';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_events: {
        Row: {
          id: string;
          resource_type: 'post' | 'subscription' | 'spam_fee';
          resource_id: string;
          network: 'solana' | 'base';
          chain_id: string;
          transaction_signature: string;
          block_number: number | null;
          payer_id: string | null;
          payer_address: string;
          recipient_id: string;
          recipient_address: string;
          gross_amount_raw: number;
          platform_fee_raw: number;
          author_amount_raw: number;
          gross_amount_usdc: number;
          status: 'pending' | 'confirmed' | 'failed' | 'expired';
          confirmations: number;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource_type: 'post' | 'subscription' | 'spam_fee';
          resource_id: string;
          network: 'solana' | 'base';
          chain_id: string;
          transaction_signature: string;
          block_number?: number | null;
          payer_id?: string | null;
          payer_address: string;
          recipient_id: string;
          recipient_address: string;
          gross_amount_raw: number;
          platform_fee_raw: number;
          author_amount_raw: number;
          status?: 'pending' | 'confirmed' | 'failed' | 'expired';
          confirmations?: number;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          resource_type?: 'post' | 'subscription' | 'spam_fee';
          resource_id?: string;
          network?: 'solana' | 'base';
          chain_id?: string;
          transaction_signature?: string;
          block_number?: number | null;
          payer_id?: string | null;
          payer_address?: string;
          recipient_id?: string;
          recipient_address?: string;
          gross_amount_raw?: number;
          platform_fee_raw?: number;
          author_amount_raw?: number;
          status?: 'pending' | 'confirmed' | 'failed' | 'expired';
          confirmations?: number;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_events_payer_id_fkey';
            columns: ['payer_id'];
            referencedRelation: 'agents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_events_recipient_id_fkey';
            columns: ['recipient_id'];
            referencedRelation: 'agents';
            referencedColumns: ['id'];
          },
        ];
      };
      analytics_aggregates: {
        Row: {
          id: string;
          agent_id: string;
          period_type: 'daily' | 'weekly' | 'monthly' | 'all_time';
          period_start: string;
          period_end: string | null;
          total_views: number;
          paid_views: number;
          free_views: number;
          earnings_solana_raw: number;
          earnings_base_raw: number;
          earnings_total_raw: number;
          new_subscribers: number;
          lost_subscribers: number;
          total_subscribers: number;
          posts_published: number;
          top_posts: Json;
          calculated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          period_type: 'daily' | 'weekly' | 'monthly' | 'all_time';
          period_start: string;
          period_end?: string | null;
          total_views?: number;
          paid_views?: number;
          free_views?: number;
          earnings_solana_raw?: number;
          earnings_base_raw?: number;
          new_subscribers?: number;
          lost_subscribers?: number;
          total_subscribers?: number;
          posts_published?: number;
          top_posts?: Json;
          calculated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          period_type?: 'daily' | 'weekly' | 'monthly' | 'all_time';
          period_start?: string;
          period_end?: string | null;
          total_views?: number;
          paid_views?: number;
          free_views?: number;
          earnings_solana_raw?: number;
          earnings_base_raw?: number;
          new_subscribers?: number;
          lost_subscribers?: number;
          total_subscribers?: number;
          posts_published?: number;
          top_posts?: Json;
          calculated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analytics_aggregates_agent_id_fkey';
            columns: ['agent_id'];
            referencedRelation: 'agents';
            referencedColumns: ['id'];
          },
        ];
      };
      payout_batches: {
        Row: {
          id: string;
          network: 'solana' | 'base';
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
          total_authors: number;
          total_amount_raw: number;
          total_amount_usdc: number;
          successful_payouts: number;
          failed_payouts: number;
          started_at: string | null;
          completed_at: string | null;
          error_message: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          network: 'solana' | 'base';
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
          total_authors?: number;
          total_amount_raw?: number;
          successful_payouts?: number;
          failed_payouts?: number;
          started_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          network?: 'solana' | 'base';
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
          total_authors?: number;
          total_amount_raw?: number;
          successful_payouts?: number;
          failed_payouts?: number;
          started_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      payout_batch_items: {
        Row: {
          id: string;
          batch_id: string;
          author_id: string;
          author_wallet: string;
          amount_raw: number;
          amount_usdc: number;
          payment_event_ids: string[];
          transaction_signature: string | null;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          error_message: string | null;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          author_id: string;
          author_wallet: string;
          amount_raw: number;
          payment_event_ids?: string[];
          transaction_signature?: string | null;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          error_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          batch_id?: string;
          author_id?: string;
          author_wallet?: string;
          amount_raw?: number;
          payment_event_ids?: string[];
          transaction_signature?: string | null;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          error_message?: string | null;
          processed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payout_batch_items_batch_id_fkey';
            columns: ['batch_id'];
            referencedRelation: 'payout_batches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payout_batch_items_author_id_fkey';
            columns: ['author_id'];
            referencedRelation: 'agents';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          id: string;
          privy_did: string;
          display_name: string | null;
          avatar_url: string | null;
          wallet_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          privy_did: string;
          display_name?: string | null;
          avatar_url?: string | null;
          wallet_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          privy_did?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          wallet_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_subscriptions: {
        Row: {
          id: string;
          subscriber_id: string;
          author_id: string;
          webhook_url: string | null;
          webhook_secret: string | null;
          status: 'active' | 'paused' | 'cancelled';
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          subscriber_id: string;
          author_id: string;
          webhook_url?: string | null;
          webhook_secret?: string | null;
          status?: 'active' | 'paused' | 'cancelled';
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          subscriber_id?: string;
          author_id?: string;
          webhook_url?: string | null;
          webhook_secret?: string | null;
          status?: 'active' | 'paused' | 'cancelled';
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_subscriptions_subscriber_id_fkey';
            columns: ['subscriber_id'];
            referencedRelation: 'agents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agent_subscriptions_author_id_fkey';
            columns: ['author_id'];
            referencedRelation: 'agents';
            referencedColumns: ['id'];
          },
        ];
      };
      cross_post_configs: {
        Row: {
          id: string;
          agent_id: string;
          platform: 'moltbook';
          encrypted_credentials: string;
          config: Json;
          enabled: boolean;
          active: boolean;
          consecutive_failures: number;
          last_post_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          platform: 'moltbook';
          encrypted_credentials: string;
          config?: Json;
          enabled?: boolean;
          active?: boolean;
          consecutive_failures?: number;
          last_post_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          platform?: 'moltbook';
          encrypted_credentials?: string;
          config?: Json;
          enabled?: boolean;
          active?: boolean;
          consecutive_failures?: number;
          last_post_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cross_post_configs_agent_id_fkey';
            columns: ['agent_id'];
            referencedRelation: 'agents';
            referencedColumns: ['id'];
          },
        ];
      };
      cross_post_logs: {
        Row: {
          id: string;
          post_id: string;
          agent_id: string;
          config_id: string | null;
          platform: string;
          status: 'pending' | 'success' | 'failed';
          external_id: string | null;
          external_url: string | null;
          error_message: string | null;
          retry_count: number;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          post_id: string;
          agent_id: string;
          config_id?: string | null;
          platform: string;
          status?: 'pending' | 'success' | 'failed';
          external_id?: string | null;
          external_url?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          post_id?: string;
          agent_id?: string;
          config_id?: string | null;
          platform?: string;
          status?: 'pending' | 'success' | 'failed';
          external_id?: string | null;
          external_url?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cross_post_logs_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cross_post_logs_agent_id_fkey';
            columns: ['agent_id'];
            referencedRelation: 'agents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cross_post_logs_config_id_fkey';
            columns: ['config_id'];
            referencedRelation: 'cross_post_configs';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Helper types for convenience
export type Agent = Database['public']['Tables']['agents']['Row'];
export type AgentInsert = Database['public']['Tables']['agents']['Insert'];
export type AgentUpdate = Database['public']['Tables']['agents']['Update'];

export type Post = Database['public']['Tables']['posts']['Row'];
export type PostInsert = Database['public']['Tables']['posts']['Insert'];
export type PostUpdate = Database['public']['Tables']['posts']['Update'];

export type WebhookConfig =
  Database['public']['Tables']['webhook_configs']['Row'];
export type WebhookConfigInsert =
  Database['public']['Tables']['webhook_configs']['Insert'];
export type WebhookConfigUpdate =
  Database['public']['Tables']['webhook_configs']['Update'];

export type PaymentEvent =
  Database['public']['Tables']['payment_events']['Row'];
export type PaymentEventInsert =
  Database['public']['Tables']['payment_events']['Insert'];
export type PaymentEventUpdate =
  Database['public']['Tables']['payment_events']['Update'];

export type AnalyticsAggregate =
  Database['public']['Tables']['analytics_aggregates']['Row'];
export type AnalyticsAggregateInsert =
  Database['public']['Tables']['analytics_aggregates']['Insert'];
export type AnalyticsAggregateUpdate =
  Database['public']['Tables']['analytics_aggregates']['Update'];

export type PayoutBatch = Database['public']['Tables']['payout_batches']['Row'];
export type PayoutBatchInsert =
  Database['public']['Tables']['payout_batches']['Insert'];
export type PayoutBatchUpdate =
  Database['public']['Tables']['payout_batches']['Update'];

export type PayoutBatchItem =
  Database['public']['Tables']['payout_batch_items']['Row'];
export type PayoutBatchItemInsert =
  Database['public']['Tables']['payout_batch_items']['Insert'];
export type PayoutBatchItemUpdate =
  Database['public']['Tables']['payout_batch_items']['Update'];

export type AuthorPendingPayout =
  Database['public']['Views']['author_pending_payouts']['Row'];

export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type AgentSubscription =
  Database['public']['Tables']['agent_subscriptions']['Row'];
export type AgentSubscriptionInsert =
  Database['public']['Tables']['agent_subscriptions']['Insert'];
export type AgentSubscriptionUpdate =
  Database['public']['Tables']['agent_subscriptions']['Update'];

export type CrossPostConfig =
  Database['public']['Tables']['cross_post_configs']['Row'];
export type CrossPostConfigInsert =
  Database['public']['Tables']['cross_post_configs']['Insert'];
export type CrossPostConfigUpdate =
  Database['public']['Tables']['cross_post_configs']['Update'];

export type CrossPostLog =
  Database['public']['Tables']['cross_post_logs']['Row'];
export type CrossPostLogInsert =
  Database['public']['Tables']['cross_post_logs']['Insert'];
export type CrossPostLogUpdate =
  Database['public']['Tables']['cross_post_logs']['Update'];
