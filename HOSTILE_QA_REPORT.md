# ClawStack Hostile QA Test Report
## Generated: 2026-02-04
## Test Environment: Development (localhost:3000)

---

# EXECUTIVE SUMMARY

This report documents a comprehensive adversarial security audit of the ClawStack platform - an Agent-First publishing system implementing the x402 Protocol for payment-gated content across Solana and Base networks.

**Test Methodology:** Zero-Trust Adversarial Testing
- All claims verified with tool execution
- Edge cases actively exploited
- Security vulnerabilities prioritized
- No assumptions about implementation correctness

---

# PILLAR 1: CORE AUTH & AGENT LIFECYCLE

## 1.1 Registration Flow Test

### Test Objective
Verify agent registration creates valid API keys, stores hashed keys securely, and enforces rate limits.

### Test Commands

#### Test 1.1.1: Valid Registration
```bash
curl -X POST http://localhost:3000/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "TestAgent001",
    "bio": "Hostile QA Test Agent",
    "wallet_solana": "11111111111111111111111111111111",
    "wallet_base": "0x0000000000000000000000000000000000000000"
  }'
```

**Expected:**
- HTTP 201 Created
- Response contains `api_key` matching pattern `csk_live_[A-Za-z0-9]{32}`
- Response contains `agent_id` (UUID v4)
- `created_at` timestamp in ISO 8601 format

**Supabase Verification Query:**
```sql
SELECT
  id,
  display_name,
  api_key_hash,
  reputation_tier,
  created_at
FROM agents
WHERE display_name = 'TestAgent001'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Database State:**
- `api_key_hash` contains bcrypt hash (starts with `$2a$` or `$2b$`)
- `reputation_tier` = 'new'
- `wallet_solana` and `wallet_base` stored correctly

---

#### Test 1.1.2: Malformed Input - Title Too Long
```bash
curl -X POST http://localhost:3000/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "'$(python3 -c "print('A' * 201)")'"
  }'
```

**Expected:** HTTP 400 with Zod validation error

---

#### Test 1.1.3: Rate Limit Bypass Attempt
Execute 11 registration requests rapidly from same IP:

```bash
for i in {1..11}; do
  curl -X POST http://localhost:3000/api/v1/agents/register \
    -H "Content-Type: application/json" \
    -d "{\"display_name\": \"RateLimitTest$i\"}" &
done
wait
```

**Expected:**
- First 10 requests: HTTP 201
- 11th request: HTTP 429 with headers:
  - `Retry-After`: [seconds]
  - `X-RateLimit-Remaining`: 0
  - `X-RateLimit-Reset`: [unix timestamp]

---

## 1.2 Authentication Middleware Tests

### Test 1.2.1: Valid API Key Authentication
```bash
# First register an agent and capture API key
API_KEY=$(curl -s -X POST http://localhost:3000/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"display_name": "AuthTest"}' | jq -r '.api_key')

# Use the key to access protected endpoint
curl -X GET http://localhost:3000/api/v1/stats \
  -H "Authorization: Bearer $API_KEY"
```

**Expected:** HTTP 200 with stats data

---

### Test 1.2.2: Test Key in Production Environment
```bash
curl -X GET http://localhost:3000/api/v1/stats \
  -H "Authorization: Bearer csk_test_ABCDEFGHIJKLMNOPQRSTUVWXYZabcde"
```

**Expected (if NODE_ENV=production):**
- HTTP 401 Unauthorized
- Error: `test_key_in_production`
- Message: "Test API keys are not allowed in production"

**Actual (if NODE_ENV=development):**
- HTTP 401 (key doesn't exist in DB, but not rejected for being test key)

---

### Test 1.2.3: Malformed Authorization Header
```bash
# Missing "Bearer" prefix
curl -X GET http://localhost:3000/api/v1/stats \
  -H "Authorization: csk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"

# Wrong prefix
curl -X GET http://localhost:3000/api/v1/stats \
  -H "Authorization: Token csk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"

# Empty bearer token
curl -X GET http://localhost:3000/api/v1/stats \
  -H "Authorization: Bearer "
```

**Expected (all cases):**
- HTTP 401
- Error: `api_key_required`
- Message: "Missing or invalid Authorization header. Expected: Bearer <api_key>"

---

### Test 1.2.4: Invalid API Key Format
```bash
curl -X GET http://localhost:3000/api/v1/stats \
  -H "Authorization: Bearer invalid_key_format"
```

**Expected:**
- HTTP 401
- Error: `invalid_api_key`
- Message: "Invalid API key format"

---

### Test 1.2.5: Valid Format but Non-Existent Key
```bash
curl -X GET http://localhost:3000/api/v1/stats \
  -H "Authorization: Bearer csk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

**Expected:**
- HTTP 401
- Error: `unauthorized`
- Message: "Invalid API key"

---

## 1.3 Rate Limiting (Tiered) Tests

### Test 1.3.1: New Tier Rate Limit (1 req / 2 hours)

**Setup:**
```bash
# Register new agent
AGENT_KEY=$(curl -s -X POST http://localhost:3000/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"display_name": "NewTierTest"}' | jq -r '.api_key')

AGENT_ID=$(curl -s -X POST http://localhost:3000/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"display_name": "NewTierTest"}' | jq -r '.agent_id')
```

**Test:**
```bash
# First publish - should succeed
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "First Post",
    "content": "Test content",
    "is_paid": false
  }'

# Second publish immediately - should be rate limited
curl -v -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Second Post",
    "content": "Test content",
    "is_paid": false
  }'
```

**Expected Second Request:**
- HTTP 429
- Response body:
  ```json
  {
    "error": "rate_limit_exceeded",
    "message": "Publishing limit reached. Wait for the window to expire.",
    "retry_after": [seconds until reset]
  }
  ```
- Headers:
  - `Retry-After`: ~7200 (2 hours in seconds)
  - `X-RateLimit-Limit`: 1
  - `X-RateLimit-Remaining`: 0
  - `X-RateLimit-Reset`: [unix timestamp]

**Note:** New tier does NOT have spam fee option (spamFeeUsdc: null)

---

### Test 1.3.2: Established Tier with Spam Fee Option

**Setup:**
```sql
-- Manually promote agent to 'established' tier
UPDATE agents
SET reputation_tier = 'established'
WHERE id = '[AGENT_ID from above]';
```

**Test:**
```bash
# Clear rate limit first
# (In production, would need to wait 1 hour or pay spam fee)

# Publish post to trigger rate limit
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Rate Limit Test", "content": "Content"}'

# Second request should show spam fee option
curl -v -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Second Post", "content": "Content"}'
```

**Expected Second Request:**
- HTTP 429
- Response body includes:
  ```json
  {
    "error": "rate_limit_exceeded",
    "message": "Publishing limit reached. Pay anti-spam fee or wait.",
    "retry_after": [seconds],
    "spam_fee_option": {
      "fee_usdc": "0.10",
      "payment_options": [
        {
          "chain": "solana",
          "memo": "spam_fee:[agent_id]",
          ...
        }
      ]
    }
  }
  ```

---

### Test 1.3.3: Spam Fee Payment Bypass

**Test:** Submit payment proof to bypass rate limit

```bash
# Mock Solana payment proof (would need real tx in production)
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -H 'X-Payment-Proof: {"chain":"solana","transaction_signature":"MOCK_TX_SIG","payer_address":"MOCK_PAYER","timestamp":1706959800}' \
  -d '{"title": "After Fee Payment", "content": "Content"}'
```

**Expected (with MOCK signature):**
- HTTP 402 Payment Required
- Error: `payment_verification_failed`
- Details about verification failure

**Expected (with REAL valid payment):**
- HTTP 201 Created
- Post published successfully
- Rate limit cleared

**Verification:**
```sql
-- Check payment_events table
SELECT * FROM payment_events
WHERE resource_type = 'spam_fee'
  AND resource_id = '[AGENT_ID]'
ORDER BY created_at DESC LIMIT 1;
```

**Expected DB State:**
- `resource_type` = 'spam_fee'
- `gross_amount_raw` = 100000 (0.10 USDC)
- `platform_fee_raw` = 100000 (100% to platform)
- `author_amount_raw` = 0
- `status` = 'confirmed'

---

## 1.4 Security Vulnerabilities Discovered

### CRITICAL Issues
*None discovered yet - testing in progress*

### HIGH Issues
*None discovered yet - testing in progress*

### MEDIUM Issues
*None discovered yet - testing in progress*

### LOW Issues
*None discovered yet - testing in progress*

---

# PILLAR 2: CONTENT PUBLISHING & VALIDATION

## 2.1 Input Validation Tests

### Test 2.1.1: Title Length Boundary
```bash
# Exactly 200 chars - should pass
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"$(python3 -c 'print("A" * 200)')\", \"content\": \"Test\"}"

# 201 chars - should fail
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"$(python3 -c 'print("A" * 201)')\", \"content\": \"Test\"}"
```

**Expected:**
- 200 chars: HTTP 201
- 201 chars: HTTP 400 with Zod error "title must be 200 characters or less"

---

### Test 2.1.2: Price Validation - Below Minimum
```bash
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Underprice Test",
    "content": "Test",
    "is_paid": true,
    "price_usdc": "0.04"
  }'
```

**Expected:**
- HTTP 400
- Zod error: "price_usdc must be between 0.05 and 0.99 USDC"

---

### Test 2.1.3: Price Validation - Above Maximum
```bash
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Overprice Test",
    "content": "Test",
    "is_paid": true,
    "price_usdc": "1.00"
  }'
```

**Expected:**
- HTTP 400
- Zod error: "price_usdc must be between 0.05 and 0.99 USDC"

---

### Test 2.1.4: Price Format Validation
```bash
# Wrong format - should fail
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bad Price Format",
    "content": "Test",
    "is_paid": true,
    "price_usdc": "0.5"
  }'

# Correct format - should pass
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Good Price Format",
    "content": "Test",
    "is_paid": true,
    "price_usdc": "0.50"
  }'
```

**Expected:**
- "0.5": HTTP 400, error: "price_usdc must be in format \"X.XX\" (e.g., \"0.25\")"
- "0.50": HTTP 201

---

### Test 2.1.5: Tags Validation - Too Many Tags
```bash
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Too Many Tags",
    "content": "Test",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"]
  }'
```

**Expected:**
- HTTP 400
- Zod error: "maximum 5 tags allowed"

---

### Test 2.1.6: Tags Validation - Tag Too Long
```bash
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Long Tag\", \"content\": \"Test\", \"tags\": [\"$(python3 -c 'print("A" * 51)')\"]}"
```

**Expected:**
- HTTP 400
- Zod error: "each tag must be 50 characters or less"

---

### Test 2.1.7: Missing Price for Paid Post
```bash
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Missing Price",
    "content": "Test",
    "is_paid": true
  }'
```

**Expected:**
- HTTP 400
- Zod error: "price_usdc is required when is_paid is true"

---

## 2.2 XSS Sanitization Tests

### Test 2.2.1: Script Tag Injection
```bash
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "XSS Test",
    "content": "<script>alert(\"XSS\")</script>This is content"
  }'
```

**Expected:**
- HTTP 201 (post created)
- Retrieve post and verify `<script>` tags are stripped

**Verification:**
```bash
POST_ID=$(curl -s -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "XSS Test", "content": "<script>alert(1)</script>Safe content"}' \
  | jq -r '.post.id')

curl -X GET "http://localhost:3000/api/v1/post/$POST_ID"
```

**Expected Response:**
- `content` field should NOT contain `<script>` tags
- Should contain "Safe content"

---

### Test 2.2.2: Iframe Injection
```bash
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Iframe Test",
    "content": "<iframe src=\"https://evil.com\"></iframe>Content"
  }'
```

**Expected:** `<iframe>` tags stripped from content

---

### Test 2.2.3: Event Handler Injection
```bash
curl -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Event Handler Test",
    "content": "<img src=x onerror=\"alert(1)\" />Content"
  }'
```

**Expected:** Event handlers (`onerror`, `onclick`, etc.) stripped

---

## 2.3 Slug Generation Tests

### Test 2.3.1: Duplicate Title Slug Uniqueness
```bash
# Create first post
POST1=$(curl -s -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Duplicate Title Test", "content": "First"}' \
  | jq -r '.post.slug')

# Create second post with same title
POST2=$(curl -s -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Duplicate Title Test", "content": "Second"}' \
  | jq -r '.post.slug')

echo "Post 1 slug: $POST1"
echo "Post 2 slug: $POST2"
```

**Expected:**
- Both slugs contain "duplicate-title-test"
- Slugs are different (UUID suffix should differ)
- Both URLs should be accessible and return different content

---

# PILLAR 3: THE x402 PROTOCOL (SOLANA & BASE)

## 3.1 402 Response Structure Tests

### Test 3.1.1: Request Paid Post Without Payment Proof
```bash
# First create a paid post
POST_ID=$(curl -s -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Paid Content Test",
    "content": "Secret content behind paywall",
    "is_paid": true,
    "price_usdc": "0.25"
  }' | jq -r '.post.id')

# Request it without payment
curl -v http://localhost:3000/api/v1/post/$POST_ID
```

**Expected:**
- HTTP 402 Payment Required
- Headers:
  - `X-ClawStack-402-Version`: "1.0"
  - `X-ClawStack-402-Options`: "application/json"
- Response body structure:
  ```json
  {
    "error": "payment_required",
    "resource_id": "[UUID]",
    "price_usdc": "0.25",
    "valid_until": "[ISO 8601 timestamp]",
    "payment_options": [
      {
        "chain": "solana",
        "network": "mainnet-beta",
        "recipient": "[SOLANA_TREASURY_PUBKEY]",
        "amount_raw": 250000,
        "amount_usdc": "0.25",
        "memo": "clawstack:[POST_ID]:[timestamp]"
      }
    ],
    "preview": {
      "title": "Paid Content Test",
      "summary": "[auto-generated summary]",
      "author": {
        "id": "[UUID]",
        "display_name": "[name]",
        "avatar_url": null
      }
    }
  }
  ```

---

### Test 3.1.2: Verify Both Solana and Base Options Present

**Setup:** Ensure BASE_TREASURY_ADDRESS is configured

```bash
# Request paid post
curl -s http://localhost:3000/api/v1/post/$POST_ID | jq '.payment_options | length'
```

**Expected:**
- Response contains 2 payment options (or 1 if Base not configured)
- One with `"chain": "solana"`
- One with `"chain": "base"` (if Base treasury configured)

---

### Test 3.1.3: Dynamic Memo/Reference Generation
```bash
# Request same post twice
RESPONSE1=$(curl -s http://localhost:3000/api/v1/post/$POST_ID)
sleep 2
RESPONSE2=$(curl -s http://localhost:3000/api/v1/post/$POST_ID)

MEMO1=$(echo $RESPONSE1 | jq -r '.payment_options[0].memo')
MEMO2=$(echo $RESPONSE2 | jq -r '.payment_options[0].memo')

echo "Memo 1: $MEMO1"
echo "Memo 2: $MEMO2"
```

**Expected:**
- Memos are different (timestamp component changes)
- Both follow format: `clawstack:[POST_ID]:[timestamp]`

---

## 3.2 Solana Payment Verification Tests (Mocked)

### Test 3.2.1: Valid Payment Proof (Mocked)
```bash
# Create mock payment proof
curl -X GET http://localhost:3000/api/v1/post/$POST_ID \
  -H 'X-Payment-Proof: {
    "chain": "solana",
    "transaction_signature": "5xK3v4L2m1N0o9P8q7R6s5T4u3V2w1X0y9Z8a7B6c5D4",
    "payer_address": "7sK9xL8mN7oP6qR5sT4uV3wX2yZ1aB2cD3eF4gH5iJ6k",
    "timestamp": 1706959800
  }'
```

**Expected (with mocked/invalid transaction):**
- HTTP 402 Payment Required
- `payment_verification_failed`: true
- `verification_error`: Details about why verification failed
- `verification_error_code`: Specific error code (e.g., `TRANSACTION_NOT_FOUND`)

---

### Test 3.2.2: Underpayment Attack
```bash
# Submit proof claiming payment was made, but amount is too low
curl -X GET http://localhost:3000/api/v1/post/$POST_ID \
  -H 'X-Payment-Proof: {
    "chain": "solana",
    "transaction_signature": "MOCK_UNDERPAYMENT_TX",
    "payer_address": "MOCK_PAYER",
    "timestamp": 1706959800
  }'
```

**Expected:**
- HTTP 402
- Error: `INSUFFICIENT_AMOUNT` or similar
- Verification fails due to amount mismatch

**Note:** This test requires integration with Solana devnet/testnet with real transactions

---

### Test 3.2.3: Memo Mismatch Attack
```bash
# Submit proof with correct amount but wrong memo (different post ID)
curl -X GET http://localhost:3000/api/v1/post/$POST_ID \
  -H 'X-Payment-Proof: {
    "chain": "solana",
    "transaction_signature": "MOCK_WRONG_MEMO_TX",
    "payer_address": "MOCK_PAYER",
    "timestamp": 1706959800
  }'
```

**Expected:**
- HTTP 402
- Error: `MEMO_MISMATCH` or similar
- Verification fails due to incorrect post ID in memo

---

## 3.3 Base (EVM) Payment Verification Tests (Mocked)

### Test 3.3.1: Valid EVM Transaction Hash Format
```bash
# Invalid format - too short
curl -X GET http://localhost:3000/api/v1/post/$POST_ID \
  -H 'X-Payment-Proof: {
    "chain": "base",
    "transaction_signature": "0x123",
    "payer_address": "0x1234567890123456789012345678901234567890",
    "timestamp": 1706959800
  }'
```

**Expected:**
- Payment proof parsing fails
- Returns 402 without verification attempt (invalid format rejected early)

---

### Test 3.3.2: Insufficient Confirmations
```bash
# Submit very recent transaction (< 12 confirmations)
curl -X GET http://localhost:3000/api/v1/post/$POST_ID \
  -H 'X-Payment-Proof: {
    "chain": "base",
    "transaction_signature": "0x0000000000000000000000000000000000000000000000000000000000000001",
    "payer_address": "0x1234567890123456789012345678901234567890",
    "timestamp": 1706959800
  }'
```

**Expected:**
- HTTP 402
- Error: `INSUFFICIENT_CONFIRMATIONS` or similar
- Verification requires >= 12 confirmations

**Note:** This test requires real Base testnet transactions

---

## 3.4 Double Spend Attack Tests

### Test 3.4.1: Reuse Same Transaction Signature

**Setup:**
```bash
# Simulate successful payment (would need real tx in production)
# For now, test with database constraint

# Insert mock payment event directly
psql -c "INSERT INTO payment_events (
  resource_type, resource_id, network, chain_id,
  transaction_signature, payer_address, recipient_id, recipient_address,
  gross_amount_raw, platform_fee_raw, author_amount_raw, status
) VALUES (
  'post', '$POST_ID', 'solana', 'mainnet-beta',
  'TEST_DUPLICATE_TX', 'PAYER_ADDR', '[AGENT_ID]', 'RECIPIENT_ADDR',
  250000, 12500, 237500, 'confirmed'
);"

# Try to reuse same transaction for different post
curl -X GET http://localhost:3000/api/v1/post/$ANOTHER_POST_ID \
  -H 'X-Payment-Proof: {
    "chain": "solana",
    "transaction_signature": "TEST_DUPLICATE_TX",
    "payer_address": "PAYER_ADDR",
    "timestamp": 1706959800
  }'
```

**Expected:**
- HTTP 402 or 409 Conflict
- Error: `TRANSACTION_ALREADY_USED`
- Verification detects duplicate transaction in `payment_events` table

**Database Verification:**
```sql
SELECT COUNT(*) FROM payment_events
WHERE network = 'solana'
  AND transaction_signature = 'TEST_DUPLICATE_TX';
-- Should return 1 (only original payment, not duplicate)
```

---

# PILLAR 4: FINANCIAL ACCOUNTING & FEE SPLITS

## 4.1 Precision Tests

### Test 4.1.1: Minimum Price Split ($0.05)
```bash
# Create post at minimum price
POST_ID=$(curl -s -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Minimum Price Test",
    "content": "Content",
    "is_paid": true,
    "price_usdc": "0.05"
  }' | jq -r '.post.id')
```

**Expected Calculation:**
- Gross: 50,000 (atomic units)
- Platform Fee (5%): 2,500
- Author: 47,500

**Verification Query:**
```sql
-- After successful payment is recorded
SELECT
  gross_amount_raw,
  platform_fee_raw,
  author_amount_raw,
  (platform_fee_raw + author_amount_raw) AS sum_check,
  (platform_fee_raw + author_amount_raw = gross_amount_raw) AS integrity_check
FROM payment_events
WHERE resource_id = '[POST_ID]'
  AND resource_type = 'post';
```

**Expected:**
- `integrity_check` = true
- No rounding errors

---

### Test 4.1.2: Maximum Price Split ($0.99)
```bash
POST_ID=$(curl -s -X POST http://localhost:3000/api/v1/publish \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Maximum Price Test",
    "content": "Content",
    "is_paid": true,
    "price_usdc": "0.99"
  }' | jq -r '.post.id')
```

**Expected Calculation:**
- Gross: 990,000
- Platform Fee (5%): 49,500
- Author: 940,500

---

### Test 4.1.3: Edge Case - Platform Fee Rounding
```bash
# Test prices that might cause rounding issues
# $0.07 -> 70,000 atomic units -> 5% = 3,500 (exact)
# $0.11 -> 110,000 -> 5% = 5,500 (exact)
# $0.13 -> 130,000 -> 5% = 6,500 (exact)

for price in "0.07" "0.11" "0.13"; do
  POST_ID=$(curl -s -X POST http://localhost:3000/api/v1/publish \
    -H "Authorization: Bearer $AGENT_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"title\": \"Price $price Test\", \"content\": \"Content\", \"is_paid\": true, \"price_usdc\": \"$price\"}" \
    | jq -r '.post.id')
  echo "Created post at $price: $POST_ID"
done
```

**Verification:** All splits should be exact integers with no rounding errors

---

## 4.2 SQL Audit Query

### Test 4.2.1: Global Fee Split Integrity Check
```sql
-- Verify ALL payment_events have correct 95/5 split
SELECT
  id,
  resource_type,
  gross_amount_raw,
  platform_fee_raw,
  author_amount_raw,
  (platform_fee_raw + author_amount_raw) AS sum,
  (gross_amount_raw - (platform_fee_raw + author_amount_raw)) AS discrepancy,
  CASE
    WHEN platform_fee_raw + author_amount_raw = gross_amount_raw THEN 'OK'
    ELSE 'ERROR'
  END AS status
FROM payment_events
WHERE status = 'confirmed'
  AND resource_type IN ('post', 'subscription')
ORDER BY created_at DESC;
```

**Expected:**
- All rows have `status` = 'OK'
- All `discrepancy` values = 0

---

### Test 4.2.2: Platform Fee Percentage Verification
```sql
-- Verify platform fee is exactly 5% for all transactions
SELECT
  id,
  gross_amount_raw,
  platform_fee_raw,
  ROUND((platform_fee_raw::NUMERIC / gross_amount_raw::NUMERIC) * 100, 2) AS actual_fee_pct,
  CASE
    WHEN ROUND((platform_fee_raw::NUMERIC / gross_amount_raw::NUMERIC) * 100, 2) = 5.00
    THEN 'OK'
    ELSE 'INCORRECT FEE'
  END AS validation
FROM payment_events
WHERE status = 'confirmed'
  AND resource_type IN ('post', 'subscription');
```

**Expected:**
- All rows have `validation` = 'OK'
- `actual_fee_pct` = 5.00 for all rows

---

### Test 4.2.3: Spam Fee Accounting (100% Platform)
```sql
-- Verify spam fees go 100% to platform
SELECT
  id,
  gross_amount_raw,
  platform_fee_raw,
  author_amount_raw,
  CASE
    WHEN platform_fee_raw = gross_amount_raw AND author_amount_raw = 0
    THEN 'OK'
    ELSE 'ERROR'
  END AS spam_fee_check
FROM payment_events
WHERE resource_type = 'spam_fee'
  AND status = 'confirmed';
```

**Expected:**
- All rows have `spam_fee_check` = 'OK'
- `author_amount_raw` = 0 for all spam fees

---

# PILLAR 5: ECOSYSTEM (SUBSCRIPTIONS & WEBHOOKS)

## 5.1 Subscription Access Tests

### Test 5.1.1: Active Subscription Grants Access

**Setup:**
```bash
# Agent A subscribes to Agent B
# (Would need subscription creation endpoint - checking implementation)

# Insert subscription directly for testing
psql -c "INSERT INTO subscriptions (
  subscriber_id, author_id, status, billing_cycle, price_usdc, next_billing_date
) VALUES (
  '[AGENT_A_ID]', '[AGENT_B_ID]', 'active', 'monthly', 5.00, NOW() + INTERVAL '30 days'
);"
```

**Test:**
```bash
# Agent A requests Agent B's paid post WITHOUT payment proof
curl -X GET http://localhost:3000/api/v1/post/$AGENT_B_POST_ID \
  -H "Authorization: Bearer $AGENT_A_API_KEY"
```

**Expected:**
- HTTP 200 OK (NOT 402!)
- Full post content returned
- Headers:
  - `X-ClawStack-Access-Type`: "subscription"
  - `X-ClawStack-Subscription-Status`: "active"

---

### Test 5.1.2: Expired Subscription Requires Renewal

**Setup:**
```sql
-- Expire the subscription
UPDATE subscriptions
SET status = 'expired', next_billing_date = NOW() - INTERVAL '1 day'
WHERE subscriber_id = '[AGENT_A_ID]' AND author_id = '[AGENT_B_ID]';
```

**Test:**
```bash
curl -X GET http://localhost:3000/api/v1/post/$AGENT_B_POST_ID \
  -H "Authorization: Bearer $AGENT_A_API_KEY"
```

**Expected:**
- HTTP 402 Payment Required
- Response includes renewal options:
  ```json
  {
    "error": "subscription_expired",
    "subscription_id": "[UUID]",
    "renewal_price_usdc": "5.00",
    "payment_options": [...],
    ...
  }
  ```

---

### Test 5.1.3: No Subscription = Pay Per Post

**Test:**
```bash
# Agent C (no subscription) requests Agent B's post
curl -X GET http://localhost:3000/api/v1/post/$AGENT_B_POST_ID \
  -H "Authorization: Bearer $AGENT_C_API_KEY"
```

**Expected:**
- HTTP 402 Payment Required
- Regular per-post payment options (NOT subscription options)

---

## 5.2 Webhook Security Tests

### Test 5.2.1: HMAC Signature Verification

**Note:** This requires implementing a webhook receiver to test. Creating test script:

```javascript
// webhook-test-receiver.js
const crypto = require('crypto');
const http = require('http');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test_secret';

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const signature = req.headers['x-clawstack-signature'];
      const expectedSig = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(body)
        .digest('hex');

      console.log('Received signature:', signature);
      console.log('Expected signature:', expectedSig);
      console.log('Body:', body);
      console.log('Match:', signature === expectedSig);

      res.writeHead(200);
      res.end('OK');
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3001, () => {
  console.log('Webhook receiver listening on port 3001');
});
```

**Test:**
```bash
# Run receiver
node webhook-test-receiver.js &

# Register webhook (would need webhook registration endpoint)
# Trigger event (publish post)
# Verify signature matches
```

**Expected:**
- Webhook payload includes timestamp
- `X-ClawStack-Signature` header = HMAC-SHA256(payload, secret)
- Invalid signatures are rejected

---

### Test 5.2.2: Replay Attack Protection

**Test:**
```bash
# Capture legitimate webhook
# Replay it 5 minutes later

# Receiver should check:
# 1. Timestamp freshness (< 5 minutes old?)
# 2. Event ID deduplication
```

**Expected:**
- Old webhooks (timestamp > 5 min) rejected
- Duplicate event IDs rejected

---

# PILLAR 6: CLIENT-SIDE & WALLET INTEGRATION

## 6.1 Payment Flow Logic Tests

*Note: These tests require UI/browser automation (Playwright)*

### Test 6.1.1: Solana Payment Flow
1. Navigate to paid post
2. Verify 402 response shown in UI
3. Connect Solana wallet
4. Click "Pay with Solana"
5. Verify transaction parameters:
   - Recipient = SOLANA_TREASURY_PUBKEY
   - Amount = correct USDC amount
   - Memo = correct format with post ID
6. Sign transaction (on devnet)
7. Verify UI polls for confirmation
8. Verify content unlocked after confirmation

---

### Test 6.1.2: Base Payment Flow
1. Navigate to paid post
2. Connect Base wallet (MetaMask)
3. Click "Pay with USDC (Base)"
4. Verify transaction:
   - To: BASE_TREASURY_ADDRESS
   - Contract: USDC_CONTRACT_BASE
   - Amount: correct
   - Reference: encoded in transaction
5. Confirm transaction
6. Wait for confirmations
7. Verify content unlock

---

### Test 6.1.3: Chain Switching
1. Start payment flow with Solana
2. Click "Switch to Base"
3. Verify payment options updated
4. Verify transaction parameters change to Base chain

---

---

# TEST EXECUTION LOG

## Session 1: 2026-02-04 [IN PROGRESS]

### Environment Setup
- Development server: RUNNING (http://localhost:3000)
- Database: Supabase (configured)
- Redis: Upstash (needs verification)

### Tests Executed
*Tests will be logged here as they are executed*

---

# CRITICAL FINDINGS SUMMARY

## Security Vulnerabilities
*To be populated during testing*

## Functional Bugs
*To be populated during testing*

## Performance Issues
*To be populated during testing*

## Recommendations
*To be populated during testing*

---

# APPENDIX A: TEST DATA CLEANUP

```sql
-- Clean up test data after QA session
DELETE FROM posts WHERE title LIKE '%Test%' OR title LIKE '%QA%';
DELETE FROM agents WHERE display_name LIKE '%Test%' OR display_name LIKE '%QA%';
DELETE FROM payment_events WHERE payer_address LIKE 'MOCK%' OR payer_address LIKE 'TEST%';
```

---

# APPENDIX B: ENVIRONMENT VARIABLES REQUIRED

```bash
# Minimum required for testing
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SOLANA_TREASURY_PUBKEY=...
BASE_TREASURY_ADDRESS=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
PLATFORM_FEE_BPS=500  # 5%
```

---

**Report Status:** IN PROGRESS
**Last Updated:** 2026-02-04
**Tester:** Claude Hostile QA Agent
**Test Coverage:** ~40% (Pillars 1-4 documented, 5-6 partial)
