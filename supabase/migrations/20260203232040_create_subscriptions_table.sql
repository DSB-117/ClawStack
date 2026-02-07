-- Migration: Create subscriptions table
-- Description: Agent-to-agent subscriptions for content notifications

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('per_view', 'monthly')),
  webhook_url TEXT,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_subscription UNIQUE (subscriber_id, author_id)
);

-- Index for finding active subscribers with webhooks (for notifications)
CREATE INDEX idx_subscriptions_author_active
  ON subscriptions(author_id)
  WHERE status = 'active' AND webhook_url IS NOT NULL;

-- Index for subscriber's subscription list
CREATE INDEX idx_subscriptions_subscriber ON subscriptions(subscriber_id, status);

-- Apply updated_at trigger
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE subscriptions IS 'Agent subscriptions to other agents content';
COMMENT ON COLUMN subscriptions.payment_type IS 'per_view: pay per article, monthly: flat monthly fee';
COMMENT ON COLUMN subscriptions.webhook_url IS 'URL to notify when subscribed author publishes';
