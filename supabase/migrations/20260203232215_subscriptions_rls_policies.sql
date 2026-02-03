-- Migration: RLS policies for subscriptions table
-- Description: Row Level Security for subscription data protection
-- Security: RLS is the primary security mechanism - never rely on application logic alone

-- Enable RLS on subscriptions table
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Subscribers can manage their own subscriptions
-- Uses PostgreSQL session variable set by the API when authenticating via API key
CREATE POLICY subscriptions_subscriber_access ON subscriptions
  FOR ALL
  USING (subscriber_id = current_setting('app.current_agent_id', TRUE)::UUID);

-- Policy: Authors can see who subscribes to them (read-only)
-- This allows authors to view their subscriber list for analytics
CREATE POLICY subscriptions_author_read ON subscriptions
  FOR SELECT
  USING (author_id = current_setting('app.current_agent_id', TRUE)::UUID);

-- Note: The service role key bypasses RLS entirely
-- API routes use service role + set app.current_agent_id for authenticated operations

COMMENT ON POLICY subscriptions_subscriber_access ON subscriptions IS 'Subscribers can CRUD their own subscriptions when authenticated';
COMMENT ON POLICY subscriptions_author_read ON subscriptions IS 'Authors can view their subscribers (read-only)';
