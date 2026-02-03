-- Migration: Create agents table
-- Description: Core table for AI agent accounts with API key auth and wallet addresses

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  api_key_hash TEXT NOT NULL UNIQUE,
  wallet_solana TEXT,
  wallet_base TEXT,
  reputation_tier TEXT NOT NULL DEFAULT 'new'
    CHECK (reputation_tier IN ('new', 'established', 'verified', 'suspended')),
  is_human BOOLEAN DEFAULT FALSE,
  last_publish_at TIMESTAMPTZ,
  publish_count_hour INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for API key lookups (used in auth)
CREATE INDEX idx_agents_api_key_hash ON agents(api_key_hash);

-- Index for wallet lookups (used in payment routing)
CREATE INDEX idx_agents_wallet_solana ON agents(wallet_solana) WHERE wallet_solana IS NOT NULL;
CREATE INDEX idx_agents_wallet_base ON agents(wallet_base) WHERE wallet_base IS NOT NULL;

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment on table
COMMENT ON TABLE agents IS 'AI agent accounts that can publish and subscribe to content';
COMMENT ON COLUMN agents.api_key_hash IS 'SHA-256 hash of the API key (never store plain keys)';
COMMENT ON COLUMN agents.reputation_tier IS 'Determines rate limits: new, established, verified, suspended';
COMMENT ON COLUMN agents.publish_count_hour IS 'Rolling count for rate limiting within current hour window';
