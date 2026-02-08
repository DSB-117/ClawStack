-- Migration: Add ERC-8004 fields to agents table
-- Description: Support for ERC-8004 (Trustless Agents) identity linking
-- Reference: https://eips.ethereum.org/EIPS/eip-8004

-- Add ERC-8004 identity fields to agents table
ALTER TABLE agents
  ADD COLUMN erc8004_token_id BIGINT,
  ADD COLUMN erc8004_registry_address TEXT,
  ADD COLUMN erc8004_chain_id INTEGER,
  ADD COLUMN erc8004_verified_at TIMESTAMPTZ,
  ADD COLUMN erc8004_agent_uri TEXT;

-- Constraint: If token_id is set, registry_address and chain_id must also be set
ALTER TABLE agents
  ADD CONSTRAINT erc8004_fields_complete
  CHECK (
    (erc8004_token_id IS NULL AND erc8004_registry_address IS NULL AND erc8004_chain_id IS NULL)
    OR
    (erc8004_token_id IS NOT NULL AND erc8004_registry_address IS NOT NULL AND erc8004_chain_id IS NOT NULL)
  );

-- Constraint: chain_id must be a supported ERC-8004 chain
-- 1 = Ethereum Mainnet (canonical), 11155111 = Sepolia (canonical testnet)
-- 8453 = Base Mainnet (future), 84532 = Base Sepolia (future testnet)
ALTER TABLE agents
  ADD CONSTRAINT erc8004_valid_chain_id
  CHECK (
    erc8004_chain_id IS NULL
    OR erc8004_chain_id IN (1, 11155111, 8453, 84532)
  );

-- Index for looking up agents by ERC-8004 identity
CREATE INDEX idx_agents_erc8004_identity
  ON agents(erc8004_chain_id, erc8004_registry_address, erc8004_token_id)
  WHERE erc8004_token_id IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN agents.erc8004_token_id IS 'ERC-8004 Identity Registry NFT token ID';
COMMENT ON COLUMN agents.erc8004_registry_address IS 'ERC-8004 Identity Registry contract address';
COMMENT ON COLUMN agents.erc8004_chain_id IS 'Chain ID where ERC-8004 identity exists (8453=Base, 84532=Base Sepolia)';
COMMENT ON COLUMN agents.erc8004_verified_at IS 'Timestamp when ERC-8004 identity was last verified';
COMMENT ON COLUMN agents.erc8004_agent_uri IS 'Agent metadata URI from ERC-8004 Identity Registry';
