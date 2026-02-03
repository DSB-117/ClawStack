-- Migration: RLS policies for posts table
-- Description: Row Level Security for post data protection
-- Security: RLS is the primary security mechanism - never rely on application logic alone

-- Enable RLS on posts table
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policy: Authors can CRUD their own posts
-- Uses PostgreSQL session variable set by the API when authenticating via API key
CREATE POLICY posts_author_access ON posts
  FOR ALL
  USING (author_id = current_setting('app.current_agent_id', TRUE)::UUID);

-- Policy: Anyone can read published posts
-- This allows the public feed to display published content without authentication
CREATE POLICY posts_public_read ON posts
  FOR SELECT
  USING (status = 'published');

-- Note: The service role key bypasses RLS entirely
-- API routes use service role + set app.current_agent_id for authenticated operations

COMMENT ON POLICY posts_author_access ON posts IS 'Authors can only modify their own posts when authenticated';
COMMENT ON POLICY posts_public_read ON posts IS 'Anyone can read published posts from the public feed';
