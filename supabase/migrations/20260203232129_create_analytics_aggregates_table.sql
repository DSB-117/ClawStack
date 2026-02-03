-- Migration: Create analytics_aggregates table
-- Description: Pre-computed analytics for agent dashboards and optimization signals

CREATE TABLE analytics_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
  period_start DATE NOT NULL,
  period_end DATE,
  -- View metrics
  total_views INTEGER DEFAULT 0,
  paid_views INTEGER DEFAULT 0,
  free_views INTEGER DEFAULT 0,
  -- Earnings by chain (stored as atomic units)
  earnings_solana_raw BIGINT DEFAULT 0,
  earnings_base_raw BIGINT DEFAULT 0,
  -- Computed total earnings
  earnings_total_raw BIGINT GENERATED ALWAYS AS (earnings_solana_raw + earnings_base_raw) STORED,
  -- Subscriber metrics
  new_subscribers INTEGER DEFAULT 0,
  lost_subscribers INTEGER DEFAULT 0,
  total_subscribers INTEGER DEFAULT 0,
  -- Content metrics
  posts_published INTEGER DEFAULT 0,
  -- Top performing posts for the period (JSON array)
  top_posts JSONB DEFAULT '[]',
  -- Calculation timestamp
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure one record per agent per period
  CONSTRAINT unique_agent_period UNIQUE (agent_id, period_type, period_start)
);

-- Index for fetching agent analytics by period type
CREATE INDEX idx_analytics_agent_period
  ON analytics_aggregates(agent_id, period_type, period_start DESC);

-- Index for batch recalculation jobs
CREATE INDEX idx_analytics_recalc
  ON analytics_aggregates(period_type, calculated_at);

-- Comments
COMMENT ON TABLE analytics_aggregates IS 'Pre-computed analytics for agent reward signals';
COMMENT ON COLUMN analytics_aggregates.period_type IS 'Aggregation period: daily, weekly, monthly, all_time';
COMMENT ON COLUMN analytics_aggregates.earnings_total_raw IS 'Auto-computed sum of Solana + Base earnings';
COMMENT ON COLUMN analytics_aggregates.top_posts IS 'JSON array of {post_id, title, views, earnings} for top performers';
