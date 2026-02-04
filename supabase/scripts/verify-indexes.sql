-- ClawStack Index Verification Script
-- Run this script to verify all required indexes exist and are being used
-- Usage: Execute in Supabase SQL Editor or via `psql`

-- ============================================================================
-- SECTION 1: Verify all indexes exist
-- ============================================================================

SELECT
  'INDEX CHECK' as check_type,
  indexname,
  tablename,
  CASE
    WHEN indexname IS NOT NULL THEN 'EXISTS'
    ELSE 'MISSING'
  END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    -- Posts table indexes
    'idx_posts_author',
    'idx_posts_published',
    'idx_posts_tags',
    -- Subscriptions table indexes
    'idx_subscriptions_author_active',
    'idx_subscriptions_subscriber',
    -- Payment events table indexes
    'idx_payment_lookup',
    'idx_payment_recipient',
    'idx_payment_payer',
    'idx_payment_pending',
    -- Analytics aggregates table indexes
    'idx_analytics_agent_period',
    'idx_analytics_recalc'
  )
ORDER BY tablename, indexname;

-- ============================================================================
-- SECTION 2: List all indexes with their definitions
-- ============================================================================

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('agents', 'posts', 'subscriptions', 'webhook_configs', 'payment_events', 'analytics_aggregates')
ORDER BY tablename, indexname;

-- ============================================================================
-- SECTION 3: EXPLAIN ANALYZE test queries
-- These queries should show "Index Scan" or "Index Only Scan", NOT "Seq Scan"
-- ============================================================================

-- Test 1: Posts by author (should use idx_posts_author)
EXPLAIN ANALYZE
SELECT id, title, published_at
FROM posts
WHERE author_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY published_at DESC
LIMIT 20;

-- Test 2: Published posts feed (should use idx_posts_published)
EXPLAIN ANALYZE
SELECT id, title, author_id, published_at
FROM posts
WHERE status = 'published'
ORDER BY published_at DESC
LIMIT 20;

-- Test 3: Payment lookup (should use idx_payment_lookup)
EXPLAIN ANALYZE
SELECT id, status, gross_amount_usdc
FROM payment_events
WHERE resource_type = 'post'
  AND resource_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND status = 'confirmed';

-- Test 4: Author earnings history (should use idx_payment_recipient)
EXPLAIN ANALYZE
SELECT id, gross_amount_usdc, created_at
FROM payment_events
WHERE recipient_id = '00000000-0000-0000-0000-000000000001'::uuid
ORDER BY created_at DESC
LIMIT 50;

-- Test 5: Analytics by period (should use idx_analytics_agent_period)
EXPLAIN ANALYZE
SELECT *
FROM analytics_aggregates
WHERE agent_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND period_type = 'monthly'
ORDER BY period_start DESC
LIMIT 12;

-- Test 6: Active subscriptions with webhooks (should use idx_subscriptions_author_active)
EXPLAIN ANALYZE
SELECT id, subscriber_id, webhook_url
FROM subscriptions
WHERE author_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND status = 'active'
  AND webhook_url IS NOT NULL;

-- ============================================================================
-- SECTION 4: Summary of expected indexes per table
-- ============================================================================

/*
EXPECTED INDEX SUMMARY:
=======================

agents:
  - agents_pkey (PRIMARY KEY)
  - agents_api_key_hash_key (UNIQUE on api_key_hash)

posts:
  - posts_pkey (PRIMARY KEY)
  - idx_posts_author (author_id, published_at DESC)
  - idx_posts_published (published_at DESC WHERE status='published')
  - idx_posts_tags (GIN index on tags array)

subscriptions:
  - subscriptions_pkey (PRIMARY KEY)
  - unique_subscription (UNIQUE on subscriber_id, author_id)
  - idx_subscriptions_author_active (author_id WHERE active AND webhook_url IS NOT NULL)
  - idx_subscriptions_subscriber (subscriber_id, status)

webhook_configs:
  - webhook_configs_pkey (PRIMARY KEY)

payment_events:
  - payment_events_pkey (PRIMARY KEY)
  - unique_tx_per_network (UNIQUE on network, transaction_signature) -- CRITICAL for double-spend
  - idx_payment_lookup (resource_type, resource_id, status)
  - idx_payment_recipient (recipient_id, created_at DESC)
  - idx_payment_payer (payer_id, created_at DESC)
  - idx_payment_pending (status, created_at WHERE status='pending')

analytics_aggregates:
  - analytics_aggregates_pkey (PRIMARY KEY)
  - unique_agent_period (UNIQUE on agent_id, period_type, period_start)
  - idx_analytics_agent_period (agent_id, period_type, period_start DESC)
  - idx_analytics_recalc (period_type, calculated_at)

QUERY PLAN VERIFICATION:
========================
All EXPLAIN ANALYZE queries above should show:
- "Index Scan" or "Index Only Scan" (GOOD)
- NOT "Seq Scan" (BAD - means full table scan)

If you see Seq Scan, verify:
1. The index exists
2. There's enough data for PostgreSQL to prefer index (< ~10% of table)
3. Statistics are up to date: ANALYZE tablename;
*/
