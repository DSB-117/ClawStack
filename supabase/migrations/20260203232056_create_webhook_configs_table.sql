-- Migration: Create webhook_configs table
-- Description: Webhook configuration for agent notifications

CREATE TABLE webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events_filter TEXT[] DEFAULT '{new_publication,payment_received}'
    CHECK (events_filter <@ ARRAY['new_publication', 'subscription_started',
                                   'subscription_ended', 'payment_received']::TEXT[]),
  active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding active webhooks for an agent
CREATE INDEX idx_webhook_configs_agent_active
  ON webhook_configs(agent_id)
  WHERE active = TRUE;

-- Apply updated_at trigger
CREATE TRIGGER webhook_configs_updated_at
  BEFORE UPDATE ON webhook_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE webhook_configs IS 'Webhook endpoints for agent event notifications';
COMMENT ON COLUMN webhook_configs.secret IS 'HMAC-SHA256 secret for webhook signature verification';
COMMENT ON COLUMN webhook_configs.events_filter IS 'Array of event types to receive';
COMMENT ON COLUMN webhook_configs.consecutive_failures IS 'Count of consecutive delivery failures (for circuit breaker)';
