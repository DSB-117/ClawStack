#!/bin/bash
# Production Environment Setup for ClawStack (Vercel)
# Adds all required environment variables to Vercel

set -e

echo "🚀 ClawStack Production Setup (Vercel)"
echo "======================================"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI not found. Install it first:"
    echo "   npm install -g vercel"
    echo ""
    read -p "Press Enter to continue with manual setup instructions..."
    echo ""
fi

# Load local environment
if [ ! -f .env.local ]; then
    echo "❌ .env.local not found"
    exit 1
fi

echo "📋 Required Environment Variables for Production"
echo "================================================"
echo ""

# List of required variables
REQUIRED_VARS=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "SOLANA_TREASURY_PUBKEY"
    "BASE_TREASURY_ADDRESS"
    "UPSTASH_REDIS_REST_URL"
    "UPSTASH_REDIS_REST_TOKEN"
    "CDP_API_KEY_NAME"
    "CDP_API_KEY_PRIVATE_KEY"
    "CDP_PROJECT_ID"
    "CDP_WALLET_SECRET"
    "AGENTKIT_ENCRYPTION_SECRET"
    "CROSS_POST_ENCRYPTION_KEY"
    "NEXT_PUBLIC_PRIVY_APP_ID"
    "PRIVY_APP_SECRET"
)

# Export variables from .env.local
export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)

echo "Checking which variables are set locally:"
echo ""

MISSING_COUNT=0
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ $var - NOT SET"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    else
        VALUE="${!var}"
        # Mask secrets for display
        if [[ $var == *"SECRET"* ]] || [[ $var == *"KEY"* ]] || [[ $var == *"TOKEN"* ]]; then
            MASKED="${VALUE:0:20}..."
        else
            MASKED="${VALUE:0:40}..."
        fi
        echo "✅ $var - ${MASKED}"
    fi
done

echo ""
if [ $MISSING_COUNT -gt 0 ]; then
    echo "⚠️  WARNING: $MISSING_COUNT variables are missing locally"
    echo "   Fix .env.local first before deploying to production"
    exit 1
fi

echo "✅ All required variables are set locally!"
echo ""

# Ask if user wants to use Vercel CLI
if command -v vercel &> /dev/null; then
    echo "Would you like to add these to Vercel automatically? (y/n)"
    read -r USE_CLI

    if [[ $USE_CLI == "y" ]]; then
        echo ""
        echo "🔄 Adding variables to Vercel production..."
        echo ""

        for var in "${REQUIRED_VARS[@]}"; do
            VALUE="${!var}"
            if [ -n "$VALUE" ]; then
                echo "Adding $var..."
                echo "$VALUE" | vercel env add "$var" production --force 2>/dev/null || true
            fi
        done

        echo ""
        echo "✅ Variables added to Vercel!"
        echo ""
        echo "Next steps:"
        echo "  1. Verify in Vercel dashboard:"
        echo "     https://vercel.com/your-project/settings/environment-variables"
        echo ""
        echo "  2. Trigger a new deployment:"
        echo "     vercel --prod"
        echo ""
        echo "  3. Test production health:"
        echo "     curl https://clawstack.blog/api/v1/health | jq '.'"

        exit 0
    fi
fi

# Manual setup instructions
echo "📝 Manual Setup Instructions (Vercel Dashboard)"
echo "================================================"
echo ""
echo "1. Go to: https://vercel.com/your-project/settings/environment-variables"
echo ""
echo "2. Add each variable below:"
echo "   - Select 'Production' environment"
echo "   - Click 'Add' after each one"
echo ""
echo "Copy these commands to add them via CLI:"
echo ""

for var in "${REQUIRED_VARS[@]}"; do
    VALUE="${!var}"
    if [ -n "$VALUE" ]; then
        # Escape special characters for shell
        ESCAPED_VALUE=$(printf '%s' "$VALUE" | sed "s/'/'\\\\''/g")
        echo "echo '$ESCAPED_VALUE' | vercel env add $var production"
    fi
done

echo ""
echo "Or add them one by one in the Vercel UI:"
echo ""

for var in "${REQUIRED_VARS[@]}"; do
    VALUE="${!var}"
    if [ -n "$VALUE" ]; then
        echo "Variable: $var"
        echo "Value: $VALUE"
        echo "Environment: Production"
        echo ""
    fi
done

echo "After adding variables:"
echo "  1. Redeploy: vercel --prod"
echo "  2. Test: curl https://clawstack.blog/api/v1/health"
echo ""
