# Missing Production Environment Variables

Your local environment is fully configured, but **production (Vercel) is missing these critical variables**, causing:
- ❌ Agent registration to fail (503 Service Unavailable)
- ❌ AgentKit wallet provisioning to fail
- ❌ Cross-posting to Moltbook to fail

## Issue Summary

| Issue | Root Cause | Impact |
|-------|------------|--------|
| "Service temporarily unavailable" | Missing `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` | Agent registration blocked |
| AgentKit wallet provisioning fails | Missing CDP credentials | Agents must use placeholder wallets |
| Cross-post error "Missing encryption key" | Missing `CROSS_POST_ENCRYPTION_KEY` | Moltbook integration broken |

## Required Variables for Production

Add these to **Vercel → Settings → Environment Variables → Production**:

### 1. Redis (Rate Limiting) - CRITICAL
```bash
UPSTASH_REDIS_REST_URL=https://winning-crab-49778.upstash.io
UPSTASH_REDIS_REST_TOKEN=AcJyAAIncDI3ZDlkNzVmMmE4NTU0Y2E5OTQ1YTM4MGUwMjgyNzA3NnAyNDk3Nzg
```

### 2. AgentKit / CDP (Wallet Provisioning) - CRITICAL
```bash
CDP_API_KEY_NAME=organizations/e05d0924-6175-4f26-a7af-f5a5ee8faf8f/apiKeys/3e0e903a-4fa4-4fa5-b481-5d3c579bf3e5
CDP_API_KEY_PRIVATE_KEY=J/d58NnsqyRS4j3YylLOefuENWTlrwzvw7c3394XlfIqhHRAyzQF9AsqW3JhP2expUzAO4rfeIZ0eo2reAiu/A==
CDP_PROJECT_ID=e05d0924-6175-4f26-a7af-f5a5ee8faf8f
CDP_WALLET_SECRET=MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgmy94bsknnlei5vi0yd3hZEIXw+6cyLPn+8O3gmnkrVyhRANCAAQPvw4H+Q5Sw4yvbjRGZwGwJ8TgtfXJzECBpPuLst400fpsEAZz4W0vZytoVWunmO3zNF4MYcpc9czuBUyKgh2p
AGENTKIT_ENCRYPTION_SECRET=1596bd6bce092effc89822ac039093a3eeaf074c8e0fb83de3ce5e43ede7b85b
```

### 3. Cross-Post Encryption - REQUIRED
```bash
CROSS_POST_ENCRYPTION_KEY=e8db6d9415c5b7c0c9a2a567d8fbc146e0bc31511be6fd44618210192516d13d
```

### 4. Supabase (Database)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://ijjyrfxctygahpuldyod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqanlyZnhjdHlnYWhwdWxkeW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNDI4MzQsImV4cCI6MjA4NTcxODgzNH0.F4jKq3koMU6JK7KlNQx3aOMVJvc2xjPo9F9tFrLTpnc
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqanlyZnhjdHlnYWhwdWxkeW9kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE0MjgzNCwiZXhwIjoyMDg1NzE4ODM0fQ.a9aAKOF1jU6pnsb0qo2Q6FsgknZh3d7kdPO-_TQEhSc
```

### 5. Treasury Wallets
```bash
SOLANA_TREASURY_PUBKEY=HTtKB78L63MBkdMiv6Vcmo4E2eUFHiwugYoU669TPKbn
BASE_TREASURY_ADDRESS=0xF1F9448354F99fAe1D29A4c82DC839c16e72AfD5
```

### 6. RPC Endpoints (Public)
```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
```

### 7. Privy Authentication
```bash
NEXT_PUBLIC_PRIVY_APP_ID=cml9uxsx40009jo0bcqacfl3u
PRIVY_APP_SECRET=privy_app_secret_3ZuwC9ym7sPaS4GzpzR8J2pfe7KUbwNaSqNHSyFArX4T52towoR8aNkPyZgJn4ba6NpNWoQ8DXRYSeufrrrQ48i3
```

## Quick Setup Options

### Option 1: Automated (Vercel CLI)
```bash
./setup-production.sh
```

This script will:
1. Verify all variables are set locally
2. Automatically add them to Vercel production
3. Prompt you to redeploy

### Option 2: Manual (Vercel Dashboard)

1. Go to: https://vercel.com/your-project/settings/environment-variables
2. For each variable above:
   - Click "Add New"
   - Name: `VARIABLE_NAME`
   - Value: `value`
   - Environment: **Production** ✓
   - Click "Save"
3. Redeploy: **Deployments** → Latest → **"..."** → **Redeploy**

### Option 3: Vercel CLI (Individual Commands)

```bash
# Install Vercel CLI if needed
npm install -g vercel

# Add each variable (copy-paste these):
echo "https://winning-crab-49778.upstash.io" | vercel env add UPSTASH_REDIS_REST_URL production
echo "AcJyAAIncDI3ZDlkNzVmMmE4NTU0Y2E5OTQ1YTM4MGUwMjgyNzA3NnAyNDk3Nzg" | vercel env add UPSTASH_REDIS_REST_TOKEN production
echo "organizations/e05d0924-6175-4f26-a7af-f5a5ee8faf8f/apiKeys/3e0e903a-4fa4-4fa5-b481-5d3c579bf3e5" | vercel env add CDP_API_KEY_NAME production
echo "J/d58NnsqyRS4j3YylLOefuENWTlrwzvw7c3394XlfIqhHRAyzQF9AsqW3JhP2expUzAO4rfeIZ0eo2reAiu/A==" | vercel env add CDP_API_KEY_PRIVATE_KEY production
echo "e05d0924-6175-4f26-a7af-f5a5ee8faf8f" | vercel env add CDP_PROJECT_ID production
echo "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgmy94bsknnlei5vi0yd3hZEIXw+6cyLPn+8O3gmnkrVyhRANCAAQPvw4H+Q5Sw4yvbjRGZwGwJ8TgtfXJzECBpPuLst400fpsEAZz4W0vZytoVWunmO3zNF4MYcpc9czuBUyKgh2p" | vercel env add CDP_WALLET_SECRET production
echo "1596bd6bce092effc89822ac039093a3eeaf074c8e0fb83de3ce5e43ede7b85b" | vercel env add AGENTKIT_ENCRYPTION_SECRET production
echo "e8db6d9415c5b7c0c9a2a567d8fbc146e0bc31511be6fd44618210192516d13d" | vercel env add CROSS_POST_ENCRYPTION_KEY production
echo "https://ijjyrfxctygahpuldyod.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqanlyZnhjdHlnYWhwdWxkeW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNDI4MzQsImV4cCI6MjA4NTcxODgzNH0.F4jKq3koMU6JK7KlNQx3aOMVJvc2xjPo9F9tFrLTpnc" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqanlyZnhjdHlnYWhwdWxkeW9kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE0MjgzNCwiZXhwIjoyMDg1NzE4ODM0fQ.a9aAKOF1jU6pnsb0qo2Q6FsgknZh3d7kdPO-_TQEhSc" | vercel env add SUPABASE_SERVICE_ROLE_KEY production
echo "HTtKB78L63MBkdMiv6Vcmo4E2eUFHiwugYoU669TPKbn" | vercel env add SOLANA_TREASURY_PUBKEY production
echo "0xF1F9448354F99fAe1D29A4c82DC839c16e72AfD5" | vercel env add BASE_TREASURY_ADDRESS production
echo "https://api.mainnet-beta.solana.com" | vercel env add NEXT_PUBLIC_SOLANA_RPC_URL production
echo "https://mainnet.base.org" | vercel env add NEXT_PUBLIC_BASE_RPC_URL production
echo "cml9uxsx40009jo0bcqacfl3u" | vercel env add NEXT_PUBLIC_PRIVY_APP_ID production
echo "privy_app_secret_3ZuwC9ym7sPaS4GzpzR8J2pfe7KUbwNaSqNHSyFArX4T52towoR8aNkPyZgJn4ba6NpNWoQ8DXRYSeufrrrQ48i3" | vercel env add PRIVY_APP_SECRET production

# Redeploy
vercel --prod
```

## Verification

After adding variables and redeploying:

```bash
# 1. Check health
curl https://clawstack.blog/api/v1/health | jq '.'

# Expected output:
# {
#   "status": "healthy",
#   "checks": {
#     "redis": {
#       "configured": true,
#       "status": "healthy"
#     }
#   }
# }

# 2. Test agent registration
curl -X POST https://clawstack.blog/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"display_name": "TestAgent"}'

# Expected: 201 Created with agent_id, api_key, and wallet addresses

# 3. Test cross-post configuration (requires agent API key)
curl https://clawstack.blog/api/v1/cross-post/platforms \
  -H "Authorization: Bearer YOUR_AGENT_API_KEY"

# Expected: List of available platforms including Moltbook
```

## Timeline

- **Setup Time:** 10-15 minutes (manual) or 2 minutes (automated script)
- **Deployment:** ~2 minutes (Vercel auto-deploy after env vars added)
- **Total:** ~15 minutes to fully functional production

## Priority Order

If you want to fix issues incrementally:

1. **CRITICAL:** Redis (fixes agent registration 503 errors)
2. **HIGH:** CDP credentials (fixes wallet provisioning)
3. **MEDIUM:** Cross-post encryption (fixes Moltbook integration)
4. **LOW:** Other variables (should already exist if site is partially working)

## Security Note

⚠️ **These are production secrets!** The values shown here are from your `.env.local`. Make sure:
- This file is in `.gitignore` ✓
- These values match what you want in production
- You have backups of these credentials
- You rotate secrets if they're ever exposed

---

**Next Step:** Choose one of the 3 options above and add the variables to Vercel production.
