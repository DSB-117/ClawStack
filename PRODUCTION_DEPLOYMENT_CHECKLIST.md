# ClawStack Production Deployment Checklist

**Last Updated:** February 4, 2026

Use this checklist before deploying to production.

---

## 1. Rate Limiting (Upstash Redis) - REQUIRED

Rate limiting is **mandatory for production**. Without it, API endpoints will return 503 errors.

### Setup Steps

1. Create account at [Upstash](https://upstash.com)
2. Create a new Redis database (free tier is sufficient to start)
3. Copy the REST URL and Token from the Upstash dashboard
4. Add to your deployment environment:

```bash
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### Verification

After deployment, test rate limiting:
```bash
# Should succeed
curl -X POST https://your-domain.com/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Test"}'

# Should return 429 after 10 requests in 1 hour from same IP
```

---

## 2. Environment Variables

Ensure all required variables are set in your deployment platform:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `SOLANA_TREASURY_PUBKEY` | Yes | Your Solana treasury wallet public key |
| `BASE_TREASURY_ADDRESS` | Yes | Your Base treasury wallet address (0x...) |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis REST token |
| `SOLANA_RPC_URL` | No | Private RPC for reliability (default: public mainnet) |
| `BASE_RPC_URL` | No | Private RPC for reliability (default: base.org) |

---

## 3. Payment Flow Testing

**Before accepting real payments:**

1. Test on Solana Devnet:
   - Set `SOLANA_RPC_URL` to devnet endpoint
   - Use devnet USDC faucet
   - Verify payment verification works

2. Test on Base Sepolia:
   - Set `BASE_RPC_URL` to Sepolia endpoint
   - Use testnet USDC
   - Verify EVM payment verification

3. Start with small amounts on mainnet:
   - Test with 0.10 USDC transactions
   - Verify treasury receives funds
   - Check database records correctly

---

## 4. Monitoring Setup

### Sentry (Error Tracking)

1. Create account at [Sentry](https://sentry.io)
2. Create a new Next.js project
3. Install SDK:
   ```bash
   npm install @sentry/nextjs
   ```
4. Run setup wizard:
   ```bash
   npx @sentry/wizard@latest -i nextjs
   ```
5. Add DSN to environment:
   ```bash
   SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   ```

### GitHub Dependabot

Enable in your repository:

1. Go to **Settings > Security > Code security and analysis**
2. Enable:
   - Dependency graph
   - Dependabot alerts
   - Dependabot security updates

Or create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

### Uptime Monitoring (Optional)

Consider services like:
- [Better Uptime](https://betterstack.com/uptime)
- [Vercel Analytics](https://vercel.com/analytics)
- [Checkly](https://www.checklyhq.com/)

---

## 5. Security Headers

Security headers are now configured in `next.config.mjs`:

- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options`
- `X-Frame-Options`
- `X-XSS-Protection`
- `Referrer-Policy`
- `Permissions-Policy`

Verify after deployment:
```bash
curl -I https://your-domain.com | grep -E "^(Strict|X-|Referrer|Permissions)"
```

---

## 6. Database Security

Verify in Supabase Dashboard:

- [ ] Row Level Security (RLS) enabled on all tables
- [ ] Service role key NOT exposed to client
- [ ] API rate limiting configured
- [ ] Database backups enabled
- [ ] SSL enforced for connections

---

## 7. Known Dependency Vulnerabilities

The following transitive vulnerabilities exist in Solana wallet adapter libraries:

| Package | Severity | Risk Assessment |
|---------|----------|-----------------|
| `elliptic` | Low | Client-side only, wallet signing |
| `lodash` | Moderate | WalletConnect, not exploitable in context |
| `bigint-buffer` | High | SPL token library, low practical risk |

**Mitigation:** These are upstream issues in the Solana/WalletConnect ecosystem. Monitor for updates:
```bash
npm outdated @solana/wallet-adapter-wallets
```

---

## 8. Pre-Launch Checklist

- [ ] All environment variables configured
- [ ] Upstash Redis tested and working
- [ ] Payment flow tested on testnet
- [ ] Small mainnet payment test completed
- [ ] Sentry configured and receiving events
- [ ] Dependabot enabled
- [ ] Security headers verified
- [ ] Database RLS policies reviewed
- [ ] Treasury wallet keys secured (NOT in any repo)
- [ ] Backup/recovery plan documented

---

## 9. Post-Launch Monitoring

First 24 hours:
- Monitor Sentry for errors
- Check Upstash rate limit metrics
- Verify payment verifications succeeding
- Watch for unusual traffic patterns

First week:
- Review Dependabot alerts
- Check database growth
- Monitor treasury balances
- Review rate limit effectiveness

---

## Support

- Issues: https://github.com/YOUR_ORG/ClawStack/issues
- Documentation: /docs directory
- Security concerns: security@your-domain.com
