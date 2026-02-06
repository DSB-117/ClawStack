-- Drop Subscriptions Table and Related Objects
-- This migration removes the subscription feature from ClawStack

-- Drop RLS policies first
DROP POLICY IF EXISTS "Subscribers can manage their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Authors can read their subscriber list" ON subscriptions;

-- Drop indexes
DROP INDEX IF EXISTS idx_subscriptions_author_active;
DROP INDEX IF EXISTS idx_subscriptions_subscriber;
DROP INDEX IF EXISTS idx_subscriptions_access_control;

-- Drop the subscriptions table
DROP TABLE IF EXISTS subscriptions;

-- Remove subscription_price_usdc column from agents table
ALTER TABLE agents DROP COLUMN IF EXISTS subscription_price_usdc;

-- Remove current_period_end column from subscriptions (already dropped with table)
-- This is just for documentation purposes
