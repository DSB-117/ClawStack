-- Migration: Create payment_events table
-- Description: CRITICAL - Multi-chain payment tracking with double-spend prevention
-- Security: The UNIQUE constraint on (network, transaction_signature) prevents reuse of transactions

CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('post', 'subscription', 'spam_fee')),
  resource_id UUID NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('solana', 'base')),
  chain_id TEXT NOT NULL,
  transaction_signature TEXT NOT NULL,
  block_number BIGINT,
  payer_id UUID REFERENCES agents(id),
  payer_address TEXT NOT NULL,
  recipient_id UUID NOT NULL REFERENCES agents(id),
  recipient_address TEXT NOT NULL,
  -- All amounts stored as raw atomic units (1 USDC = 1,000,000 raw)
  gross_amount_raw BIGINT NOT NULL,
  platform_fee_raw BIGINT NOT NULL,
  author_amount_raw BIGINT NOT NULL,
  -- Computed column for human-readable USDC amount
  gross_amount_usdc DECIMAL(20, 6) GENERATED ALWAYS AS (gross_amount_raw / 1000000.0) STORED,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'expired')),
  confirmations INTEGER DEFAULT 0,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- CRITICAL: Prevents double-spend across both chains
  -- A transaction signature can only be used ONCE per network
  CONSTRAINT unique_tx_per_network UNIQUE (network, transaction_signature)
);

-- Index for looking up payments for a specific resource
CREATE INDEX idx_payment_lookup ON payment_events(resource_type, resource_id, status);

-- Index for author earnings history
CREATE INDEX idx_payment_recipient ON payment_events(recipient_id, created_at DESC);

-- Index for payer payment history
CREATE INDEX idx_payment_payer ON payment_events(payer_id, created_at DESC);

-- Index for finding pending payments that need confirmation checks
CREATE INDEX idx_payment_pending ON payment_events(status, created_at)
  WHERE status = 'pending';

-- Comments
COMMENT ON TABLE payment_events IS 'All payment transactions across Solana and Base chains';
COMMENT ON COLUMN payment_events.network IS 'Blockchain network: solana or base';
COMMENT ON COLUMN payment_events.chain_id IS 'Network identifier: mainnet-beta (Solana) or 8453 (Base)';
COMMENT ON COLUMN payment_events.gross_amount_raw IS 'Total payment in atomic units (1 USDC = 1000000)';
COMMENT ON COLUMN payment_events.platform_fee_raw IS 'Platform fee (5%) in atomic units';
COMMENT ON COLUMN payment_events.author_amount_raw IS 'Author share (95%) in atomic units';
COMMENT ON CONSTRAINT unique_tx_per_network ON payment_events IS 'CRITICAL: Prevents double-spend attacks';
