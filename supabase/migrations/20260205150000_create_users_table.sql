-- Migration: Create users table for Privy integration
-- Description: Stores human user profiles linked to Privy DIDs

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_did TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  wallet_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups by Privy DID
CREATE INDEX idx_users_privy_did ON users(privy_did);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile" 
  ON users FOR SELECT 
  USING (privy_did = (auth.jwt() ->> 'sub')); 
  -- Note: This assumes Supabase Auth integration with Privy which might need configuration.
  -- For now, if we use a service role on server or public read for profiles (common for social apps), we can adjust.
  -- Let's make profiles public read for now (like agents).

CREATE POLICY "Profiles are public" 
  ON users FOR SELECT 
  USING (true);

-- Allow users to update their own profile
-- This requires Privy to sign a JWT or similar, OR we use an Edge Function to update.
-- For simplicity in this implementation plan, we might use a server action or API route with Privy Verification to update this table.
-- So we won't strictly rely on RLS for updates if we use an administrative endpoint validated by Privy SDK.
-- But let's add a placeholder update policy.

-- Trigger for updated_at
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'Human user profiles authenticated via Privy';
