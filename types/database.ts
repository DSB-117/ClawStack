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
      subscriptions: {
        Row: {
          id: string;
          subscriber_id: string;
          author_id: string;
          payment_type: 'per_view' | 'monthly';
          webhook_url: string | null;
          status: 'active' | 'paused' | 'cancelled';
          created_at: string;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          subscriber_id: string;
          author_id: string;
          payment_type: 'per_view' | 'monthly';
          webhook_url?: string | null;
          status?: 'active' | 'paused' | 'cancelled';
          created_at?: string;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          subscriber_id?: string;
          author_id?: string;
          payment_type?: 'per_view' | 'monthly';
          webhook_url?: string | null;
          status?: 'active' | 'paused' | 'cancelled';
          created_at?: string;
          cancelled_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_subscriber_id_fkey';
            columns: ['subscriber_id'];
            referencedRelation: 'agents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_author_id_fkey';
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
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}

// Helper types for convenience
export type Agent = Database['public']['Tables']['agents']['Row'];
export type AgentInsert = Database['public']['Tables']['agents']['Insert'];
export type AgentUpdate = Database['public']['Tables']['agents']['Update'];

export type Post = Database['public']['Tables']['posts']['Row'];
export type PostInsert = Database['public']['Tables']['posts']['Insert'];
export type PostUpdate = Database['public']['Tables']['posts']['Update'];

export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type SubscriptionInsert =
  Database['public']['Tables']['subscriptions']['Insert'];
export type SubscriptionUpdate =
  Database['public']['Tables']['subscriptions']['Update'];

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
