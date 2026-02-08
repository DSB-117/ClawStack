#!/bin/bash
# Test Redis Configuration for ClawStack
# Run this after adding Redis credentials to .env.local

set -e

echo "🔍 Testing ClawStack Redis Configuration"
echo "========================================"
echo ""

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
else
    echo "❌ .env.local not found"
    exit 1
fi

# Check if Redis credentials are set
if [ -z "$UPSTASH_REDIS_REST_URL" ] || [ -z "$UPSTASH_REDIS_REST_TOKEN" ]; then
    echo "❌ Redis credentials missing in .env.local"
    echo ""
    echo "Please add:"
    echo "  UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io"
    echo "  UPSTASH_REDIS_REST_TOKEN=AXXXa_your-token"
    echo ""
    echo "Get credentials from: https://upstash.com"
    exit 1
fi

echo "✅ Redis credentials found in .env.local"
echo "   URL: ${UPSTASH_REDIS_REST_URL:0:40}..."
echo "   Token: ${UPSTASH_REDIS_REST_TOKEN:0:20}..."
echo ""

# Test Redis connection directly
echo "🔌 Testing direct Redis connection..."
REDIS_TEST=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
    "$UPSTASH_REDIS_REST_URL/ping")

HTTP_CODE=$(echo "$REDIS_TEST" | tail -n1)
RESPONSE=$(echo "$REDIS_TEST" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Redis connection successful!"
    echo "   Response: $RESPONSE"
else
    echo "❌ Redis connection failed (HTTP $HTTP_CODE)"
    echo "   Response: $RESPONSE"
    echo ""
    echo "Please verify your credentials in Upstash dashboard"
    exit 1
fi

echo ""
echo "🚀 Starting development server to test full integration..."
echo "   (Press Ctrl+C to stop after health check)"
echo ""

# Start dev server in background
npm run dev &
DEV_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Test health endpoint
echo "🏥 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/v1/health)

echo "$HEALTH_RESPONSE" | jq '.'

# Check Redis status in health response
REDIS_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.checks.redis.status // "unknown"')

echo ""
if [ "$REDIS_STATUS" = "ok" ]; then
    echo "✅ SUCCESS! Redis is fully configured and working!"
    echo ""
    echo "Next steps:"
    echo "  1. Test agent registration:"
    echo "     ./test-registration.sh"
    echo ""
    echo "  2. Add same credentials to Vercel for production:"
    echo "     https://vercel.com/your-project/settings/environment-variables"
else
    echo "❌ Redis health check failed"
    echo "   Status: $REDIS_STATUS"
    echo ""
    echo "Check server logs above for errors"
fi

# Stop dev server
kill $DEV_PID 2>/dev/null || true

echo ""
echo "✅ Test complete"
