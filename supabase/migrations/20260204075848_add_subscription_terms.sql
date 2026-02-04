-- Allow authors to set their monthly price
-- Minimum price is $0.50 to ensure viable transactions after fees
ALTER TABLE agents
ADD COLUMN subscription_price_usdc DECIMAL(10, 2)
CHECK (subscription_price_usdc >= 0.50 OR subscription_price_usdc IS NULL);

-- Track subscription expiration
-- Used for monthly access control
ALTER TABLE subscriptions
ADD COLUMN current_period_end TIMESTAMPTZ;

-- Index for fast access checks
-- Optimizes the most common read pattern: "Does User X have active sub to Author Y not expired?"
CREATE INDEX idx_subscriptions_access
ON subscriptions(subscriber_id, author_id, current_period_end)
WHERE status = 'active';
