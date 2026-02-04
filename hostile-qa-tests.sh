#!/bin/bash
#
# ClawStack Hostile QA Test Suite
# Automated adversarial testing with evidence capture
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Base URL
BASE_URL="http://localhost:3000"

# Test results file
RESULTS_FILE="qa_test_results_$(date +%Y%m%d_%H%M%S).log"

# Functions
log() {
    echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1" | tee -a "$RESULTS_FILE"
}

pass() {
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
    echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$RESULTS_FILE"
}

fail() {
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
    echo -e "${RED}[FAIL]${NC} $1" | tee -a "$RESULTS_FILE"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$RESULTS_FILE"
}

section() {
    echo -e "\n${BLUE}========================================${NC}" | tee -a "$RESULTS_FILE"
    echo -e "${BLUE}$1${NC}" | tee -a "$RESULTS_FILE"
    echo -e "${BLUE}========================================${NC}\n" | tee -a "$RESULTS_FILE"
}

# Setup: Register a test agent
setup_agent() {
    log "Setting up test agent..."
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/agents/register" \
        -H "Content-Type: application/json" \
        -d '{"display_name":"HostileQATestAgent"}')

    API_KEY=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('api_key',''))" 2>/dev/null || echo "")
    AGENT_ID=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('agent_id',''))" 2>/dev/null || echo "")

    if [ -z "$API_KEY" ] || [ -z "$AGENT_ID" ]; then
        echo "ERROR: Failed to register agent"
        echo "$RESPONSE"
        exit 1
    fi

    log "Agent registered: $AGENT_ID"
    log "API Key: ${API_KEY:0:20}..."
}

###############################################################################
# PILLAR 1: CORE AUTH & AGENT LIFECYCLE
###############################################################################

test_pillar_1() {
    section "PILLAR 1: CORE AUTH & AGENT LIFECYCLE"

    # Test 1.1: Valid authentication
    log "Test 1.1: Valid API key authentication"
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/stats" \
        -H "Authorization: Bearer $API_KEY")
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/v1/stats" \
        -H "Authorization: Bearer $API_KEY")

    if [ "$HTTP_CODE" = "200" ]; then
        pass "Valid API key accepted (HTTP $HTTP_CODE)"
    else
        fail "Valid API key rejected (HTTP $HTTP_CODE)"
        echo "Response: $RESPONSE" | tee -a "$RESULTS_FILE"
    fi

    # Test 1.2: Missing Authorization header
    log "Test 1.2: Missing Authorization header"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/v1/stats")

    if [ "$HTTP_CODE" = "401" ]; then
        pass "Missing auth header rejected (HTTP $HTTP_CODE)"
    else
        fail "Missing auth header not rejected (HTTP $HTTP_CODE)"
    fi

    # Test 1.3: Malformed Authorization header (no Bearer prefix)
    log "Test 1.3: Malformed Authorization header"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/v1/stats" \
        -H "Authorization: $API_KEY")

    if [ "$HTTP_CODE" = "401" ]; then
        pass "Malformed auth header rejected (HTTP $HTTP_CODE)"
    else
        fail "Malformed auth header not rejected (HTTP $HTTP_CODE)"
    fi

    # Test 1.4: Invalid API key format
    log "Test 1.4: Invalid API key format"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/v1/stats" \
        -H "Authorization: Bearer invalid_key_format")

    if [ "$HTTP_CODE" = "401" ]; then
        pass "Invalid key format rejected (HTTP $HTTP_CODE)"
    else
        fail "Invalid key format not rejected (HTTP $HTTP_CODE)"
    fi

    # Test 1.5: Valid format but non-existent key
    log "Test 1.5: Non-existent API key"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/v1/stats" \
        -H "Authorization: Bearer csk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")

    if [ "$HTTP_CODE" = "401" ]; then
        pass "Non-existent key rejected (HTTP $HTTP_CODE)"
    else
        fail "Non-existent key not rejected (HTTP $HTTP_CODE)"
    fi
}

###############################################################################
# PILLAR 2: CONTENT PUBLISHING & VALIDATION
###############################################################################

test_pillar_2() {
    section "PILLAR 2: CONTENT PUBLISHING & VALIDATION"

    # Test 2.1: Valid free post
    log "Test 2.1: Valid free post creation"
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title":"QA Test Post","content":"Test content"}')

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title":"QA Test Post 2","content":"Test content"}')

    if [ "$HTTP_CODE" = "201" ]; then
        pass "Free post created successfully (HTTP $HTTP_CODE)"
        POST_ID=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('post',{}).get('id',''))" 2>/dev/null || echo "")
        log "Post ID: $POST_ID"
    else
        fail "Free post creation failed (HTTP $HTTP_CODE)"
        echo "Response: $RESPONSE" | tee -a "$RESULTS_FILE"
    fi

    # Test 2.2: Title too long (201 chars)
    log "Test 2.2: Title length validation (201 chars)"
    LONG_TITLE=$(python3 -c "print('A' * 201)")
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"title\":\"$LONG_TITLE\",\"content\":\"Test\"}")

    if [ "$HTTP_CODE" = "400" ]; then
        pass "Title length validation works (HTTP $HTTP_CODE)"
    else
        fail "Title length validation failed (HTTP $HTTP_CODE)"
    fi

    # Test 2.3: Price below minimum
    log "Test 2.3: Price validation - below minimum (0.04)"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title":"Underprice","content":"Test","is_paid":true,"price_usdc":"0.04"}')

    if [ "$HTTP_CODE" = "400" ]; then
        pass "Minimum price validation works (HTTP $HTTP_CODE)"
    else
        fail "Minimum price validation failed (HTTP $HTTP_CODE)"
    fi

    # Test 2.4: Price above maximum
    log "Test 2.4: Price validation - above maximum (1.00)"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title":"Overprice","content":"Test","is_paid":true,"price_usdc":"1.00"}')

    if [ "$HTTP_CODE" = "400" ]; then
        pass "Maximum price validation works (HTTP $HTTP_CODE)"
    else
        fail "Maximum price validation failed (HTTP $HTTP_CODE)"
    fi

    # Test 2.5: Wrong price format
    log "Test 2.5: Price format validation (0.5 instead of 0.50)"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title":"Bad Format","content":"Test","is_paid":true,"price_usdc":"0.5"}')

    if [ "$HTTP_CODE" = "400" ]; then
        pass "Price format validation works (HTTP $HTTP_CODE)"
    else
        fail "Price format validation failed (HTTP $HTTP_CODE)"
    fi

    # Test 2.6: Too many tags
    log "Test 2.6: Tags validation - too many (6 tags)"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title":"Too Many Tags","content":"Test","tags":["t1","t2","t3","t4","t5","t6"]}')

    if [ "$HTTP_CODE" = "400" ]; then
        pass "Maximum tags validation works (HTTP $HTTP_CODE)"
    else
        fail "Maximum tags validation failed (HTTP $HTTP_CODE)"
    fi

    # Test 2.7: XSS attempt - script tag
    log "Test 2.7: XSS sanitization - script tag"
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title":"XSS Test","content":"<script>alert(1)</script>Safe content"}')

    if echo "$RESPONSE" | grep -q '"success":true'; then
        POST_ID=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('post',{}).get('id',''))" 2>/dev/null || echo "")
        # Retrieve post to check sanitization
        CONTENT=$(curl -s -X GET "$BASE_URL/api/v1/post/$POST_ID" | \
            python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('post',{}).get('content',''))" 2>/dev/null || echo "")

        if echo "$CONTENT" | grep -q "<script>"; then
            fail "XSS sanitization FAILED - script tags not removed"
            warn "CRITICAL SECURITY VULNERABILITY: XSS possible"
        else
            pass "XSS sanitization works - script tags removed"
        fi
    else
        warn "Could not test XSS sanitization - post creation failed"
    fi
}

###############################################################################
# PILLAR 3: x402 PROTOCOL TESTS
###############################################################################

test_pillar_3() {
    section "PILLAR 3: x402 PROTOCOL (PAYMENT FLOW)"

    # Test 3.1: Create paid post
    log "Test 3.1: Create paid post"
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title":"Paid Content Test","content":"Secret behind paywall","is_paid":true,"price_usdc":"0.25"}')

    PAID_POST_ID=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('post',{}).get('id',''))" 2>/dev/null || echo "")

    if [ -n "$PAID_POST_ID" ]; then
        pass "Paid post created: $PAID_POST_ID"
    else
        fail "Failed to create paid post"
        echo "Response: $RESPONSE" | tee -a "$RESULTS_FILE"
        return
    fi

    # Test 3.2: Request paid post without payment proof
    log "Test 3.2: Request paid post without payment - expect 402"
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/post/$PAID_POST_ID")
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/v1/post/$PAID_POST_ID")

    if [ "$HTTP_CODE" = "402" ]; then
        pass "Unpaid request returns 402 Payment Required"

        # Verify response structure
        ERROR=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null || echo "")
        PRICE=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('price_usdc',''))" 2>/dev/null || echo "")

        if [ "$ERROR" = "payment_required" ]; then
            pass "Response contains correct error field"
        else
            fail "Response missing 'payment_required' error"
        fi

        if [ "$PRICE" = "0.25" ]; then
            pass "Response contains correct price"
        else
            fail "Response price mismatch: expected 0.25, got $PRICE"
        fi

        # Check payment_options array
        OPTIONS_LENGTH=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('payment_options',[])))" 2>/dev/null || echo "0")

        if [ "$OPTIONS_LENGTH" -gt "0" ]; then
            pass "Response contains payment_options ($OPTIONS_LENGTH chains)"
        else
            fail "Response missing payment_options"
        fi

    else
        fail "Paid post returned HTTP $HTTP_CODE instead of 402"
        echo "Response: $RESPONSE" | tee -a "$RESULTS_FILE"
    fi

    # Test 3.3: Invalid payment proof format
    log "Test 3.3: Submit invalid payment proof"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/v1/post/$PAID_POST_ID" \
        -H 'X-Payment-Proof: invalid_json')

    if [ "$HTTP_CODE" = "402" ]; then
        pass "Invalid payment proof rejected (HTTP $HTTP_CODE)"
    else
        warn "Invalid payment proof returned HTTP $HTTP_CODE (expected 402)"
    fi

    # Test 3.4: Valid format but unverified transaction
    log "Test 3.4: Submit unverified transaction proof"
    PROOF='{"chain":"solana","transaction_signature":"MOCK_TX_SIGNATURE_FOR_TESTING","payer_address":"MOCK_PAYER","timestamp":1706959800}'
    RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/post/$PAID_POST_ID" \
        -H "X-Payment-Proof: $PROOF")
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/api/v1/post/$PAID_POST_ID" \
        -H "X-Payment-Proof: $PROOF")

    if [ "$HTTP_CODE" = "402" ]; then
        pass "Unverified transaction rejected (HTTP $HTTP_CODE)"

        # Check for verification error details
        VERIFICATION_FAILED=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('payment_verification_failed',False))" 2>/dev/null || echo "False")

        if [ "$VERIFICATION_FAILED" = "True" ]; then
            pass "Response indicates verification failure"
        else
            warn "Response doesn't clearly indicate verification failure"
        fi
    else
        fail "Unverified transaction not rejected (HTTP $HTTP_CODE)"
    fi
}

###############################################################################
# RATE LIMITING TESTS
###############################################################################

test_rate_limiting() {
    section "RATE LIMITING TESTS"

    # Test: Hit publish rate limit
    log "Test: Publish rate limit for 'new' tier (1 req / 2 hours)"

    # First request should succeed
    HTTP_CODE1=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title":"Rate Limit Test 1","content":"First post"}')

    if [ "$HTTP_CODE1" = "201" ]; then
        pass "First publish request succeeded (HTTP $HTTP_CODE1)"
    else
        warn "First publish request failed (HTTP $HTTP_CODE1)"
    fi

    # Second request should be rate limited
    RESPONSE2=$(curl -s -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title":"Rate Limit Test 2","content":"Second post"}')
    HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/publish" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"title":"Rate Limit Test 3","content":"Third post"}')

    if [ "$HTTP_CODE2" = "429" ]; then
        pass "Second publish request rate limited (HTTP $HTTP_CODE2)"

        # Check rate limit headers
        RETRY_AFTER=$(curl -s -i -X POST "$BASE_URL/api/v1/publish" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"title":"Test","content":"Test"}' | grep -i "retry-after" | cut -d':' -f2 | tr -d '[:space:]')

        if [ -n "$RETRY_AFTER" ]; then
            pass "Retry-After header present: $RETRY_AFTER seconds"
        else
            warn "Retry-After header missing"
        fi

        # Check if spam fee option is present (new tier should not have it)
        SPAM_FEE=$(echo "$RESPONSE2" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('spam_fee_option',{}).get('fee_usdc',''))" 2>/dev/null || echo "")

        if [ -z "$SPAM_FEE" ]; then
            pass "'new' tier correctly has no spam fee bypass option"
        else
            fail "'new' tier incorrectly offers spam fee bypass: $SPAM_FEE"
        fi

    else
        fail "Second publish request not rate limited (HTTP $HTTP_CODE2)"
    fi
}

###############################################################################
# MAIN EXECUTION
###############################################################################

main() {
    echo "===================================" | tee "$RESULTS_FILE"
    echo "ClawStack Hostile QA Test Suite" | tee -a "$RESULTS_FILE"
    echo "Started: $(date)" | tee -a "$RESULTS_FILE"
    echo "===================================" | tee -a "$RESULTS_FILE"
    echo ""

    # Setup
    setup_agent

    # Run test suites
    test_pillar_1
    test_pillar_2
    test_pillar_3
    test_rate_limiting

    # Summary
    section "TEST SUMMARY"
    echo "Total Tests: $TOTAL_TESTS" | tee -a "$RESULTS_FILE"
    echo "Passed: $PASSED_TESTS" | tee -a "$RESULTS_FILE"
    echo "Failed: $FAILED_TESTS" | tee -a "$RESULTS_FILE"

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}ALL TESTS PASSED${NC}" | tee -a "$RESULTS_FILE"
    else
        echo -e "${RED}SOME TESTS FAILED${NC}" | tee -a "$RESULTS_FILE"
    fi

    echo ""
    echo "Full results saved to: $RESULTS_FILE"
    echo "Completed: $(date)" | tee -a "$RESULTS_FILE"
}

# Run tests
main
