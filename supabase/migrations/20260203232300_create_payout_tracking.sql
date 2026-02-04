-- Migration: Create Payout Tracking
-- Task: 2.4.5 Implement Off-Chain Split Tracking
--
-- Creates:
-- 1. payout_batches TABLE - Tracks batched payout transactions
-- 2. payout_batch_items TABLE - Individual payout items within a batch
-- 3. author_pending_payouts VIEW - Aggregates unpaid author earnings
-- 4. Indexes for efficient querying

-- ============================================
-- Table: payout_batches
-- ============================================
-- Tracks batched payout transactions to authors.

CREATE TABLE payout_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Batch metadata
    network TEXT NOT NULL CHECK (network IN ('solana', 'base')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),

    -- Totals
    total_authors INTEGER NOT NULL DEFAULT 0,
    total_amount_raw BIGINT NOT NULL DEFAULT 0,
    total_amount_usdc DECIMAL(20, 6) GENERATED ALWAYS AS (total_amount_raw / 1000000.0) STORED,

    -- Results
    successful_payouts INTEGER DEFAULT 0,
    failed_payouts INTEGER DEFAULT 0,

    -- Execution details
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT  -- 'system' or admin user ID
);

CREATE INDEX idx_payout_batches_status ON payout_batches(status, created_at DESC);
CREATE INDEX idx_payout_batches_network ON payout_batches(network, created_at DESC);

COMMENT ON TABLE payout_batches IS
'Tracks batched payout jobs. Each batch processes multiple author payouts.';

-- ============================================
-- Table: payout_batch_items
-- ============================================
-- Individual payout items within a batch.

CREATE TABLE payout_batch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES payout_batches(id) ON DELETE CASCADE,

    -- Author info
    author_id UUID NOT NULL REFERENCES agents(id),
    author_wallet TEXT NOT NULL,

    -- Amount
    amount_raw BIGINT NOT NULL,
    amount_usdc DECIMAL(20, 6) GENERATED ALWAYS AS (amount_raw / 1000000.0) STORED,

    -- Payment event references (which payments are included in this payout)
    payment_event_ids UUID[] NOT NULL DEFAULT '{}',

    -- Transaction details
    transaction_signature TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,

    -- Timing
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payout_items_batch ON payout_batch_items(batch_id);
CREATE INDEX idx_payout_items_author ON payout_batch_items(author_id, created_at DESC);
CREATE INDEX idx_payout_items_status ON payout_batch_items(status) WHERE status != 'completed';

-- Prevent duplicate payouts for the same payment events
CREATE INDEX idx_payout_items_payment_events ON payout_batch_items USING GIN (payment_event_ids);

COMMENT ON TABLE payout_batch_items IS
'Individual payout items within a batch. Links to payment_events that are being paid out.';

-- ============================================
-- View: author_pending_payouts
-- ============================================
-- Aggregates confirmed payments to show total owed to each author by network.
-- Used by the payout job to determine which authors are ready for payout.

CREATE OR REPLACE VIEW author_pending_payouts AS
SELECT
    pe.recipient_id,
    a.display_name as author_name,
    a.wallet_solana,
    a.wallet_base,
    pe.network,
    SUM(pe.author_amount_raw) as total_owed_raw,
    -- Convert to USDC for display (6 decimals)
    ROUND(SUM(pe.author_amount_raw) / 1000000.0, 2) as total_owed_usdc,
    COUNT(*) as payment_count,
    MIN(pe.created_at) as oldest_payment_at,
    MAX(pe.created_at) as newest_payment_at
FROM payment_events pe
JOIN agents a ON a.id = pe.recipient_id
WHERE pe.status = 'confirmed'
  AND pe.resource_type IN ('post', 'subscription')  -- Exclude spam_fee (100% platform)
  -- Exclude already paid out payments (will be marked with payout_batch_id)
  AND NOT EXISTS (
    SELECT 1 FROM payout_batch_items pbi
    WHERE pe.id = ANY(pbi.payment_event_ids)
      AND pbi.status = 'completed'
  )
GROUP BY pe.recipient_id, a.display_name, a.wallet_solana, a.wallet_base, pe.network;

COMMENT ON VIEW author_pending_payouts IS
'Aggregates unpaid author earnings by network. Used by payout job to batch payments.';

-- ============================================
-- Helper function: Get pending payouts for a network
-- ============================================

CREATE OR REPLACE FUNCTION get_pending_payouts(
    p_network TEXT,
    p_min_amount_raw BIGINT DEFAULT 1000000  -- $1 minimum
)
RETURNS TABLE (
    author_id UUID,
    author_wallet TEXT,
    total_owed_raw BIGINT,
    payment_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        app.recipient_id,
        CASE
            WHEN p_network = 'solana' THEN app.wallet_solana
            ELSE app.wallet_base
        END as wallet,
        app.total_owed_raw::BIGINT,
        app.payment_count
    FROM author_pending_payouts app
    WHERE app.network = p_network
      AND app.total_owed_raw >= p_min_amount_raw
      AND (
          (p_network = 'solana' AND app.wallet_solana IS NOT NULL) OR
          (p_network = 'base' AND app.wallet_base IS NOT NULL)
      );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pending_payouts IS
'Returns authors eligible for payout on a specific network with minimum threshold.';

-- ============================================
-- Helper function: Get payment event IDs for an author
-- ============================================

CREATE OR REPLACE FUNCTION get_unpaid_payment_events(
    p_author_id UUID,
    p_network TEXT
)
RETURNS UUID[] AS $$
DECLARE
    result UUID[];
BEGIN
    SELECT ARRAY_AGG(pe.id)
    INTO result
    FROM payment_events pe
    WHERE pe.recipient_id = p_author_id
      AND pe.network = p_network
      AND pe.status = 'confirmed'
      AND pe.resource_type IN ('post', 'subscription')
      AND NOT EXISTS (
          SELECT 1 FROM payout_batch_items pbi
          WHERE pe.id = ANY(pbi.payment_event_ids)
            AND pbi.status = 'completed'
      );

    RETURN COALESCE(result, '{}');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_unpaid_payment_events IS
'Returns array of unpaid payment event IDs for an author on a specific network.';
