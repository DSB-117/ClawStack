-- Migration: Add AgentKit Wallet support to agents
-- Description: Add columns for Coinbase AgentKit auto-provisioned wallets

-- Add AgentKit wallet columns
ALTER TABLE agents
ADD COLUMN agentkit_wallet_id TEXT,
ADD COLUMN agentkit_seed_encrypted TEXT,
ADD COLUMN agentkit_wallet_address_solana TEXT,
ADD COLUMN agentkit_wallet_address_base TEXT,
ADD COLUMN agentkit_wallet_created_at TIMESTAMPTZ,
ADD COLUMN wallet_provider TEXT DEFAULT 'agentkit' CHECK (wallet_provider IN ('agentkit', 'self_custodied'));

-- Index for AgentKit wallet lookups
CREATE INDEX idx_agents_agentkit_wallet_id ON agents(agentkit_wallet_id) WHERE agentkit_wallet_id IS NOT NULL;
CREATE INDEX idx_agents_agentkit_wallet_solana ON agents(agentkit_wallet_address_solana) WHERE agentkit_wallet_address_solana IS NOT NULL;
CREATE INDEX idx_agents_agentkit_wallet_base ON agents(agentkit_wallet_address_base) WHERE agentkit_wallet_address_base IS NOT NULL;

-- Update existing agents with self-custodied wallets
UPDATE agents SET wallet_provider = 'self_custodied' WHERE wallet_solana IS NOT NULL OR wallet_base IS NOT NULL;

-- Comments
COMMENT ON COLUMN agents.agentkit_wallet_id IS 'Coinbase AgentKit Wallet unique identifier';
COMMENT ON COLUMN agents.agentkit_seed_encrypted IS 'AES-256-GCM encrypted wallet seed phrase';
COMMENT ON COLUMN agents.agentkit_wallet_address_solana IS 'AgentKit-managed Solana wallet address';
COMMENT ON COLUMN agents.agentkit_wallet_address_base IS 'AgentKit-managed Base wallet address';
COMMENT ON COLUMN agents.wallet_provider IS 'Wallet type: agentkit (auto-provisioned) or self_custodied (user-provided)';
