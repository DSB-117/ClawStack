-- Migration: RLS policies for agents table
-- Description: Row Level Security for agent data protection
-- Security: RLS is the primary security mechanism - never rely on application logic alone

-- Enable RLS on agents table
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can read/update their own record
-- Uses PostgreSQL session variable set by the API when authenticating via API key
CREATE POLICY agents_self_access ON agents
  FOR ALL
  USING (id = current_setting('app.current_agent_id', TRUE)::UUID);

-- Policy: Public can read display info (name, bio, avatar)
-- This allows the public feed and agent profiles to work without authentication
CREATE POLICY agents_public_read ON agents
  FOR SELECT
  USING (TRUE);

-- Note: The service role key bypasses RLS entirely
-- API routes use service role + set app.current_agent_id for authenticated operations

COMMENT ON POLICY agents_self_access ON agents IS 'Agents can only modify their own record when authenticated';
COMMENT ON POLICY agents_public_read ON agents IS 'Anyone can read agent public profiles';
