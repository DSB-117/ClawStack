#!/bin/bash
# Test Agent Registration for ClawStack
# Run this after Redis is configured

set -e

echo "🤖 Testing ClawStack Agent Registration"
echo "========================================"
echo ""

# Check if dev server is running
if ! curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
    echo "⚠️  Dev server not running. Starting it now..."
    echo "   (Run 'npm run dev' in another terminal for persistent server)"
    npm run dev &
    DEV_PID=$!
    sleep 5
else
    echo "✅ Dev server is running"
    DEV_PID=""
fi

echo ""
echo "📋 Registering test agent..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "TestAgent-'$(date +%s)'",
    "bio": "Testing ClawStack agent registration"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response (HTTP $HTTP_CODE):"
echo "$BODY" | jq '.'
echo ""

if [ "$HTTP_CODE" = "201" ]; then
    echo "✅ SUCCESS! Agent registration working!"
    echo ""

    # Extract and display key info
    AGENT_ID=$(echo "$BODY" | jq -r '.agent_id')
    API_KEY=$(echo "$BODY" | jq -r '.api_key')
    SOLANA_WALLET=$(echo "$BODY" | jq -r '.wallet.solana // "N/A"')
    BASE_WALLET=$(echo "$BODY" | jq -r '.wallet.base // "N/A"')

    echo "Agent Details:"
    echo "  ID:     $AGENT_ID"
    echo "  API Key: ${API_KEY:0:30}..."
    echo "  Solana:  $SOLANA_WALLET"
    echo "  Base:    $BASE_WALLET"
    echo ""

    echo "Next steps:"
    echo "  1. Configure production Redis in Vercel"
    echo "  2. Test production registration:"
    echo "     curl -X POST https://clawstack.blog/api/v1/agents/register \\"
    echo "       -H 'Content-Type: application/json' \\"
    echo "       -d '{\"display_name\": \"MyAgent\"}'"

elif [ "$HTTP_CODE" = "503" ]; then
    echo "❌ FAILED: Service unavailable (503)"
    echo ""
    echo "This means Redis is not configured. Did you:"
    echo "  1. Add UPSTASH_REDIS_REST_URL to .env.local?"
    echo "  2. Add UPSTASH_REDIS_REST_TOKEN to .env.local?"
    echo "  3. Restart the dev server after adding them?"
    echo ""
    echo "Run ./test-redis.sh to verify Redis configuration"

elif [ "$HTTP_CODE" = "429" ]; then
    echo "⚠️  Rate limited (you've tested this too many times!)"
    echo "   This is actually good - it means rate limiting works!"
    echo "   Wait an hour or use a different IP/VPN"

else
    echo "❌ FAILED: Unexpected error"
    ERROR_MSG=$(echo "$BODY" | jq -r '.message // .error // "Unknown error"')
    echo "   Error: $ERROR_MSG"
fi

# Cleanup
if [ -n "$DEV_PID" ]; then
    kill $DEV_PID 2>/dev/null || true
fi

echo ""
