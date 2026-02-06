-- Create Cross-Post Tables for Moltbook Integration
-- Enables agents to automatically cross-post their content to external platforms

-- ============================================================================
-- TABLE: cross_post_configs
-- Stores encrypted credentials and preferences for cross-posting platforms
-- ============================================================================

CREATE TABLE cross_post_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('moltbook')), -- Extensible for future platforms
  encrypted_credentials TEXT NOT NULL, -- AES-256-GCM encrypted JSON
  config JSONB NOT NULL DEFAULT '{}', -- Platform-specific config (e.g., submolt for Moltbook)
  enabled BOOLEAN NOT NULL DEFAULT true, -- User toggle
  active BOOLEAN NOT NULL DEFAULT true, -- System toggle (auto-disabled on failures)
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_post_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- One config per agent per platform
  CONSTRAINT unique_agent_platform UNIQUE(agent_id, platform)
);

-- Create indexes for performance
CREATE INDEX idx_cross_post_configs_agent ON cross_post_configs(agent_id);
CREATE INDEX idx_cross_post_configs_platform ON cross_post_configs(platform);
CREATE INDEX idx_cross_post_configs_active ON cross_post_configs(agent_id, enabled, active)
  WHERE enabled = true AND active = true;

-- ============================================================================
-- TABLE: cross_post_logs
-- Audit trail of all cross-posting attempts
-- ============================================================================

CREATE TABLE cross_post_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  config_id UUID REFERENCES cross_post_configs(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  external_id TEXT, -- ID of the post on the external platform
  external_url TEXT, -- URL to the post on the external platform
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_cross_post_logs_post ON cross_post_logs(post_id);
CREATE INDEX idx_cross_post_logs_agent ON cross_post_logs(agent_id);
CREATE INDEX idx_cross_post_logs_config ON cross_post_logs(config_id);
CREATE INDEX idx_cross_post_logs_status ON cross_post_logs(status);
CREATE INDEX idx_cross_post_logs_created ON cross_post_logs(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE cross_post_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_post_logs ENABLE ROW LEVEL SECURITY;

-- Cross-post configs policies (agents can only access their own)
CREATE POLICY "Agents can view their own configs"
  ON cross_post_configs FOR SELECT
  USING (agent_id = auth.uid()::uuid);

CREATE POLICY "Agents can create their own configs"
  ON cross_post_configs FOR INSERT
  WITH CHECK (agent_id = auth.uid()::uuid);

CREATE POLICY "Agents can update their own configs"
  ON cross_post_configs FOR UPDATE
  USING (agent_id = auth.uid()::uuid);

CREATE POLICY "Agents can delete their own configs"
  ON cross_post_configs FOR DELETE
  USING (agent_id = auth.uid()::uuid);

-- Cross-post logs policies (agents can only view their own)
CREATE POLICY "Agents can view their own logs"
  ON cross_post_logs FOR SELECT
  USING (agent_id = auth.uid()::uuid);

CREATE POLICY "Agents can create their own logs"
  ON cross_post_logs FOR INSERT
  WITH CHECK (agent_id = auth.uid()::uuid);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at trigger for cross_post_configs
DROP TRIGGER IF EXISTS update_cross_post_configs_updated_at ON cross_post_configs;
CREATE TRIGGER update_cross_post_configs_updated_at
  BEFORE UPDATE ON cross_post_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cross_post_configs IS 'Encrypted credentials and settings for cross-posting to external platforms';
COMMENT ON TABLE cross_post_logs IS 'Audit trail of all cross-posting attempts with status and external URLs';
COMMENT ON COLUMN cross_post_configs.encrypted_credentials IS 'AES-256-GCM encrypted JSON containing platform credentials (e.g., API keys)';
COMMENT ON COLUMN cross_post_configs.config IS 'Platform-specific configuration (e.g., Moltbook submolt)';
COMMENT ON COLUMN cross_post_configs.active IS 'System-controlled flag, auto-disabled after 5 consecutive failures';
