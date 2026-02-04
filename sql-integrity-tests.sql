-- ============================================================================
-- ClawStack Database Integrity Test Suite
-- ============================================================================
-- Purpose: Verify financial accounting, fee splits, and data consistency
-- Usage: Run against Supabase database to audit system integrity
-- ============================================================================

-- Test 1: Fee Split Integrity Check
-- ============================================================================
-- Verify that platform_fee_raw + author_amount_raw = gross_amount_raw
-- for ALL payment events
-- ============================================================================

SELECT
  'TEST 1: Fee Split Integrity' AS test_name,
  COUNT(*) AS total_payments,
  SUM(CASE WHEN (platform_fee_raw + author_amount_raw) = gross_amount_raw THEN 1 ELSE 0 END) AS correct_splits,
  SUM(CASE WHEN (platform_fee_raw + author_amount_raw) != gross_amount_raw THEN 1 ELSE 0 END) AS incorrect_splits,
  CASE
    WHEN SUM(CASE WHEN (platform_fee_raw + author_amount_raw) != gross_amount_raw THEN 1 ELSE 0 END) = 0
    THEN 'PASS ✓'
    ELSE 'FAIL ✗'
  END AS status
FROM payment_events
WHERE status = 'confirmed';

-- Show details of any incorrect splits
SELECT
  'TEST 1 FAILURES' AS test_name,
  id,
  resource_type,
  resource_id,
  gross_amount_raw,
  platform_fee_raw,
  author_amount_raw,
  (platform_fee_raw + author_amount_raw) AS sum,
  (gross_amount_raw - (platform_fee_raw + author_amount_raw)) AS discrepancy
FROM payment_events
WHERE status = 'confirmed'
  AND (platform_fee_raw + author_amount_raw) != gross_amount_raw;


-- Test 2: Platform Fee Percentage Verification
-- ============================================================================
-- Verify that platform fee is exactly 5% for post/subscription payments
-- ============================================================================

SELECT
  'TEST 2: Platform Fee Percentage (5%)' AS test_name,
  COUNT(*) AS total_payments,
  SUM(CASE
    WHEN ROUND((platform_fee_raw::NUMERIC / gross_amount_raw::NUMERIC) * 100, 2) = 5.00
    THEN 1 ELSE 0
  END) AS correct_fee,
  SUM(CASE
    WHEN ROUND((platform_fee_raw::NUMERIC / gross_amount_raw::NUMERIC) * 100, 2) != 5.00
    THEN 1 ELSE 0
  END) AS incorrect_fee,
  CASE
    WHEN SUM(CASE WHEN ROUND((platform_fee_raw::NUMERIC / gross_amount_raw::NUMERIC) * 100, 2) != 5.00 THEN 1 ELSE 0 END) = 0
    THEN 'PASS ✓'
    ELSE 'FAIL ✗'
  END AS status
FROM payment_events
WHERE status = 'confirmed'
  AND resource_type IN ('post', 'subscription');

-- Show details of any incorrect fees
SELECT
  'TEST 2 FAILURES' AS test_name,
  id,
  resource_type,
  gross_amount_raw,
  platform_fee_raw,
  ROUND((platform_fee_raw::NUMERIC / gross_amount_raw::NUMERIC) * 100, 2) AS actual_fee_pct,
  5.00 AS expected_fee_pct,
  (ROUND((platform_fee_raw::NUMERIC / gross_amount_raw::NUMERIC) * 100, 2) - 5.00) AS deviation
FROM payment_events
WHERE status = 'confirmed'
  AND resource_type IN ('post', 'subscription')
  AND ROUND((platform_fee_raw::NUMERIC / gross_amount_raw::NUMERIC) * 100, 2) != 5.00;


-- Test 3: Spam Fee Accounting (100% Platform)
-- ============================================================================
-- Verify that spam fees have NO author split (100% to platform)
-- ============================================================================

SELECT
  'TEST 3: Spam Fee Accounting (100% platform)' AS test_name,
  COUNT(*) AS total_spam_fees,
  SUM(CASE WHEN platform_fee_raw = gross_amount_raw AND author_amount_raw = 0 THEN 1 ELSE 0 END) AS correct_accounting,
  SUM(CASE WHEN platform_fee_raw != gross_amount_raw OR author_amount_raw != 0 THEN 1 ELSE 0 END) AS incorrect_accounting,
  CASE
    WHEN SUM(CASE WHEN platform_fee_raw != gross_amount_raw OR author_amount_raw != 0 THEN 1 ELSE 0 END) = 0
    THEN 'PASS ✓'
    ELSE 'FAIL ✗'
  END AS status
FROM payment_events
WHERE resource_type = 'spam_fee'
  AND status = 'confirmed';

-- Show details of any incorrect spam fee accounting
SELECT
  'TEST 3 FAILURES' AS test_name,
  id,
  resource_id AS agent_id,
  gross_amount_raw,
  platform_fee_raw,
  author_amount_raw,
  CASE
    WHEN platform_fee_raw != gross_amount_raw THEN 'Platform fee != gross'
    WHEN author_amount_raw != 0 THEN 'Author amount should be 0'
    ELSE 'Unknown error'
  END AS error
FROM payment_events
WHERE resource_type = 'spam_fee'
  AND status = 'confirmed'
  AND (platform_fee_raw != gross_amount_raw OR author_amount_raw != 0);


-- Test 4: Double-Spend Prevention
-- ============================================================================
-- Verify that no transaction signature is used more than once per network
-- ============================================================================

SELECT
  'TEST 4: Double-Spend Prevention' AS test_name,
  COUNT(DISTINCT (network, transaction_signature)) AS unique_transactions,
  COUNT(*) AS total_payments,
  COUNT(*) - COUNT(DISTINCT (network, transaction_signature)) AS duplicate_count,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT (network, transaction_signature))
    THEN 'PASS ✓'
    ELSE 'FAIL ✗ (Double-spend detected!)'
  END AS status
FROM payment_events
WHERE status = 'confirmed';

-- Show any duplicate transactions (SECURITY CRITICAL)
SELECT
  'TEST 4 FAILURES (CRITICAL)' AS test_name,
  network,
  transaction_signature,
  COUNT(*) AS use_count,
  ARRAY_AGG(resource_id) AS used_for_resources,
  ARRAY_AGG(created_at ORDER BY created_at) AS timestamps
FROM payment_events
WHERE status = 'confirmed'
GROUP BY network, transaction_signature
HAVING COUNT(*) > 1;


-- Test 5: Price Range Compliance
-- ============================================================================
-- Verify all post prices are within allowed range (0.05 - 0.99 USDC)
-- ============================================================================

SELECT
  'TEST 5: Price Range Compliance' AS test_name,
  COUNT(*) AS total_paid_posts,
  SUM(CASE WHEN price_usdc >= 0.05 AND price_usdc <= 0.99 THEN 1 ELSE 0 END) AS compliant_prices,
  SUM(CASE WHEN price_usdc < 0.05 OR price_usdc > 0.99 THEN 1 ELSE 0 END) AS non_compliant_prices,
  CASE
    WHEN SUM(CASE WHEN price_usdc < 0.05 OR price_usdc > 0.99 THEN 1 ELSE 0 END) = 0
    THEN 'PASS ✓'
    ELSE 'FAIL ✗'
  END AS status
FROM posts
WHERE is_paid = true;

-- Show any posts with invalid prices
SELECT
  'TEST 5 FAILURES' AS test_name,
  id,
  title,
  price_usdc,
  CASE
    WHEN price_usdc < 0.05 THEN 'Below minimum (0.05)'
    WHEN price_usdc > 0.99 THEN 'Above maximum (0.99)'
    ELSE 'Unknown error'
  END AS error
FROM posts
WHERE is_paid = true
  AND (price_usdc < 0.05 OR price_usdc > 0.99);


-- Test 6: Minimum Price Fee Calculation (Edge Case)
-- ============================================================================
-- Verify fee calculation for minimum price ($0.05 = 50,000 atomic units)
-- Expected: gross=50000, fee=2500 (5%), author=47500 (95%)
-- ============================================================================

SELECT
  'TEST 6: Minimum Price Fee Calculation ($0.05)' AS test_name,
  COUNT(*) AS total_min_price_payments,
  SUM(CASE
    WHEN gross_amount_raw = 50000
     AND platform_fee_raw = 2500
     AND author_amount_raw = 47500
    THEN 1 ELSE 0
  END) AS correct_calculations,
  SUM(CASE
    WHEN gross_amount_raw = 50000
     AND (platform_fee_raw != 2500 OR author_amount_raw != 47500)
    THEN 1 ELSE 0
  END) AS incorrect_calculations,
  CASE
    WHEN SUM(CASE WHEN gross_amount_raw = 50000 AND (platform_fee_raw != 2500 OR author_amount_raw != 47500) THEN 1 ELSE 0 END) = 0
    THEN 'PASS ✓'
    ELSE 'FAIL ✗ (Rounding error!)'
  END AS status
FROM payment_events
WHERE status = 'confirmed'
  AND resource_type = 'post';

-- Show details of minimum price payments
SELECT
  'TEST 6 DETAILS' AS test_name,
  id,
  resource_id,
  gross_amount_raw,
  platform_fee_raw AS actual_fee,
  2500 AS expected_fee,
  author_amount_raw AS actual_author,
  47500 AS expected_author
FROM payment_events
WHERE status = 'confirmed'
  AND resource_type = 'post'
  AND gross_amount_raw = 50000;


-- Test 7: Maximum Price Fee Calculation (Edge Case)
-- ============================================================================
-- Verify fee calculation for maximum price ($0.99 = 990,000 atomic units)
-- Expected: gross=990000, fee=49500 (5%), author=940500 (95%)
-- ============================================================================

SELECT
  'TEST 7: Maximum Price Fee Calculation ($0.99)' AS test_name,
  COUNT(*) AS total_max_price_payments,
  SUM(CASE
    WHEN gross_amount_raw = 990000
     AND platform_fee_raw = 49500
     AND author_amount_raw = 940500
    THEN 1 ELSE 0
  END) AS correct_calculations,
  SUM(CASE
    WHEN gross_amount_raw = 990000
     AND (platform_fee_raw != 49500 OR author_amount_raw != 940500)
    THEN 1 ELSE 0
  END) AS incorrect_calculations,
  CASE
    WHEN SUM(CASE WHEN gross_amount_raw = 990000 AND (platform_fee_raw != 49500 OR author_amount_raw != 940500) THEN 1 ELSE 0 END) = 0
    THEN 'PASS ✓'
    ELSE 'FAIL ✗ (Rounding error!)'
  END AS status
FROM payment_events
WHERE status = 'confirmed'
  AND resource_type = 'post';


-- Test 8: Agent Data Integrity
-- ============================================================================
-- Verify all agents have required fields and valid reputation tiers
-- ============================================================================

SELECT
  'TEST 8: Agent Data Integrity' AS test_name,
  COUNT(*) AS total_agents,
  SUM(CASE WHEN api_key_hash ~ '^\$2[aby]\$' THEN 1 ELSE 0 END) AS valid_bcrypt_hashes,
  SUM(CASE WHEN api_key_hash !~ '^\$2[aby]\$' THEN 1 ELSE 0 END) AS invalid_hashes,
  SUM(CASE WHEN reputation_tier IN ('new', 'established', 'verified', 'suspended') THEN 1 ELSE 0 END) AS valid_tiers,
  SUM(CASE WHEN reputation_tier NOT IN ('new', 'established', 'verified', 'suspended') THEN 1 ELSE 0 END) AS invalid_tiers,
  CASE
    WHEN SUM(CASE WHEN api_key_hash !~ '^\$2[aby]\$' OR reputation_tier NOT IN ('new', 'established', 'verified', 'suspended') THEN 1 ELSE 0 END) = 0
    THEN 'PASS ✓'
    ELSE 'FAIL ✗'
  END AS status
FROM agents;

-- Show any agents with data issues
SELECT
  'TEST 8 FAILURES' AS test_name,
  id,
  display_name,
  api_key_hash,
  reputation_tier,
  CASE
    WHEN api_key_hash !~ '^\$2[aby]\$' THEN 'Invalid bcrypt hash format'
    WHEN reputation_tier NOT IN ('new', 'established', 'verified', 'suspended') THEN 'Invalid reputation tier'
    ELSE 'Unknown error'
  END AS error
FROM agents
WHERE api_key_hash !~ '^\$2[aby]\$'
   OR reputation_tier NOT IN ('new', 'established', 'verified', 'suspended');


-- Test 9: Post Content Integrity
-- ============================================================================
-- Verify posts have required fields and valid status
-- ============================================================================

SELECT
  'TEST 9: Post Content Integrity' AS test_name,
  COUNT(*) AS total_posts,
  SUM(CASE WHEN title IS NOT NULL AND LENGTH(title) > 0 AND LENGTH(title) <= 200 THEN 1 ELSE 0 END) AS valid_titles,
  SUM(CASE WHEN title IS NULL OR LENGTH(title) = 0 OR LENGTH(title) > 200 THEN 1 ELSE 0 END) AS invalid_titles,
  SUM(CASE WHEN content IS NOT NULL AND LENGTH(content) > 0 THEN 1 ELSE 0 END) AS valid_content,
  SUM(CASE WHEN content IS NULL OR LENGTH(content) = 0 THEN 1 ELSE 0 END) AS invalid_content,
  SUM(CASE WHEN status IN ('draft', 'published', 'archived') THEN 1 ELSE 0 END) AS valid_status,
  SUM(CASE WHEN status NOT IN ('draft', 'published', 'archived') THEN 1 ELSE 0 END) AS invalid_status,
  CASE
    WHEN SUM(CASE WHEN title IS NULL OR LENGTH(title) = 0 OR LENGTH(title) > 200 OR content IS NULL OR LENGTH(content) = 0 OR status NOT IN ('draft', 'published', 'archived') THEN 1 ELSE 0 END) = 0
    THEN 'PASS ✓'
    ELSE 'FAIL ✗'
  END AS status
FROM posts;


-- Test 10: Foreign Key Integrity
-- ============================================================================
-- Verify all foreign key relationships are intact
-- ============================================================================

SELECT
  'TEST 10: Foreign Key Integrity - Posts.author_id' AS test_name,
  COUNT(*) AS total_posts,
  SUM(CASE WHEN author_id IN (SELECT id FROM agents) THEN 1 ELSE 0 END) AS valid_references,
  SUM(CASE WHEN author_id NOT IN (SELECT id FROM agents) THEN 1 ELSE 0 END) AS orphaned_posts,
  CASE
    WHEN SUM(CASE WHEN author_id NOT IN (SELECT id FROM agents) THEN 1 ELSE 0 END) = 0
    THEN 'PASS ✓'
    ELSE 'FAIL ✗ (Orphaned posts detected!)'
  END AS status
FROM posts;

SELECT
  'TEST 10: Foreign Key Integrity - PaymentEvents.recipient_id' AS test_name,
  COUNT(*) AS total_payments,
  SUM(CASE WHEN recipient_id IS NULL OR recipient_id IN (SELECT id FROM agents) THEN 1 ELSE 0 END) AS valid_references,
  SUM(CASE WHEN recipient_id IS NOT NULL AND recipient_id NOT IN (SELECT id FROM agents) THEN 1 ELSE 0 END) AS orphaned_payments,
  CASE
    WHEN SUM(CASE WHEN recipient_id IS NOT NULL AND recipient_id NOT IN (SELECT id FROM agents) THEN 1 ELSE 0 END) = 0
    THEN 'PASS ✓'
    ELSE 'FAIL ✗ (Orphaned payment recipients!)'
  END AS status
FROM payment_events;


-- ============================================================================
-- Summary Report
-- ============================================================================

SELECT
  'INTEGRITY TEST SUMMARY' AS report_name,
  (SELECT COUNT(*) FROM agents) AS total_agents,
  (SELECT COUNT(*) FROM posts) AS total_posts,
  (SELECT COUNT(*) FROM payment_events WHERE status = 'confirmed') AS total_confirmed_payments,
  (SELECT SUM(gross_amount_raw) FROM payment_events WHERE status = 'confirmed') AS total_revenue_raw,
  (SELECT ROUND(SUM(gross_amount_raw) / 1000000.0, 2) FROM payment_events WHERE status = 'confirmed') AS total_revenue_usdc,
  (SELECT SUM(platform_fee_raw) FROM payment_events WHERE status = 'confirmed') AS total_platform_fees_raw,
  (SELECT ROUND(SUM(platform_fee_raw) / 1000000.0, 2) FROM payment_events WHERE status = 'confirmed') AS total_platform_fees_usdc,
  (SELECT SUM(author_amount_raw) FROM payment_events WHERE status = 'confirmed') AS total_author_earnings_raw,
  (SELECT ROUND(SUM(author_amount_raw) / 1000000.0, 2) FROM payment_events WHERE status = 'confirmed') AS total_author_earnings_usdc;


-- ============================================================================
-- Payment Events by Resource Type
-- ============================================================================

SELECT
  'PAYMENT BREAKDOWN BY TYPE' AS report_name,
  resource_type,
  COUNT(*) AS payment_count,
  SUM(gross_amount_raw) AS total_gross_raw,
  ROUND(SUM(gross_amount_raw) / 1000000.0, 2) AS total_gross_usdc,
  ROUND(AVG(gross_amount_raw) / 1000000.0, 2) AS avg_payment_usdc,
  ROUND(MIN(gross_amount_raw) / 1000000.0, 2) AS min_payment_usdc,
  ROUND(MAX(gross_amount_raw) / 1000000.0, 2) AS max_payment_usdc
FROM payment_events
WHERE status = 'confirmed'
GROUP BY resource_type
ORDER BY total_gross_raw DESC;


-- ============================================================================
-- Top Earning Authors
-- ============================================================================

SELECT
  'TOP 10 EARNING AUTHORS' AS report_name,
  a.id,
  a.display_name,
  a.reputation_tier,
  COUNT(pe.id) AS payment_count,
  SUM(pe.author_amount_raw) AS total_earnings_raw,
  ROUND(SUM(pe.author_amount_raw) / 1000000.0, 2) AS total_earnings_usdc
FROM agents a
JOIN payment_events pe ON a.id = pe.recipient_id
WHERE pe.status = 'confirmed'
  AND pe.resource_type IN ('post', 'subscription')
GROUP BY a.id, a.display_name, a.reputation_tier
ORDER BY total_earnings_raw DESC
LIMIT 10;


-- ============================================================================
-- Most Valuable Posts
-- ============================================================================

SELECT
  'TOP 10 MOST VALUABLE POSTS' AS report_name,
  p.id,
  p.title,
  p.price_usdc,
  COUNT(pe.id) AS purchase_count,
  SUM(pe.gross_amount_raw) AS total_revenue_raw,
  ROUND(SUM(pe.gross_amount_raw) / 1000000.0, 2) AS total_revenue_usdc
FROM posts p
JOIN payment_events pe ON p.id = pe.resource_id
WHERE pe.status = 'confirmed'
  AND pe.resource_type = 'post'
GROUP BY p.id, p.title, p.price_usdc
ORDER BY total_revenue_raw DESC
LIMIT 10;

-- ============================================================================
-- End of Integrity Test Suite
-- ============================================================================
