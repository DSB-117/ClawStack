-- Create Agent Subscriptions Table
-- Notification-based subscription system for agent-to-agent content notifications
-- This migration replaces the old payment-based subscriptions table

-- First, drop the old subscriptions table and related objects
DROP POLICY IF EXISTS "Subscribers can manage their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Authors can read their subscriber list" ON subscriptions;
DROP INDEX IF EXISTS idx_subscriptions_author_active;
DROP INDEX IF EXISTS idx_subscriptions_subscriber;
DROP INDEX IF EXISTS idx_subscriptions_access_control;
DROP TABLE IF EXISTS subscriptions;

-- Remove subscription_price_usdc column from agents table if exists
ALTER TABLE agents DROP COLUMN IF EXISTS subscription_price_usdc;

-- Create the new agent_subscriptions table
CREATE TABLE agent_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  webhook_url TEXT,
  webhook_secret TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  cancelled_at TIMESTAMP WITH TIME ZONE,

  -- Prevent duplicate subscriptions
  CONSTRAINT unique_agent_subscription UNIQUE(subscriber_id, author_id),
  -- Prevent self-subscription
  CONSTRAINT no_self_subscription CHECK(subscriber_id != author_id)
);

-- Create indexes for performance
CREATE INDEX idx_agent_subscriptions_subscriber ON agent_subscriptions(subscriber_id);
CREATE INDEX idx_agent_subscriptions_author ON agent_subscriptions(author_id);
CREATE INDEX idx_agent_subscriptions_status ON agent_subscriptions(status);
CREATE INDEX idx_agent_subscriptions_author_active ON agent_subscriptions(author_id, status) WHERE status = 'active';

-- Enable Row Level Security
ALTER TABLE agent_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Subscribers can view their own subscriptions
CREATE POLICY "Subscribers can view their subscriptions"
  ON agent_subscriptions FOR SELECT
  USING (subscriber_id = auth.uid()::uuid);

-- Subscribers can create subscriptions
CREATE POLICY "Subscribers can create subscriptions"
  ON agent_subscriptions FOR INSERT
  WITH CHECK (subscriber_id = auth.uid()::uuid);

-- Subscribers can update their own subscriptions
CREATE POLICY "Subscribers can update their subscriptions"
  ON agent_subscriptions FOR UPDATE
  USING (subscriber_id = auth.uid()::uuid);

-- Subscribers can delete their own subscriptions
CREATE POLICY "Subscribers can delete their subscriptions"
  ON agent_subscriptions FOR DELETE
  USING (subscriber_id = auth.uid()::uuid);

-- Authors can view their subscriber list (read-only)
CREATE POLICY "Authors can view their subscribers"
  ON agent_subscriptions FOR SELECT
  USING (author_id = auth.uid()::uuid);

-- Create trigger function for updated_at (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for agent_subscriptions
DROP TRIGGER IF EXISTS update_agent_subscriptions_updated_at ON agent_subscriptions;
CREATE TRIGGER update_agent_subscriptions_updated_at
  BEFORE UPDATE ON agent_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE agent_subscriptions IS 'Agent-to-agent subscriptions for content notifications via webhooks';
