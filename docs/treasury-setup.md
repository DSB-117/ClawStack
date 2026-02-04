# ClawStack Treasury Setup Guide

This document provides step-by-step instructions for setting up the platform treasury wallet on Solana.

## Prerequisites

- Solana CLI installed (`solana --version` should work)
- SPL Token CLI installed (`spl-token --version` should work)
- Access to environment configuration files

### Install Solana CLI (if not installed)

```bash
# macOS / Linux
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify installation
solana --version
```

### Install SPL Token CLI

```bash
cargo install spl-token-cli

# Or using pre-built binaries
# See: https://spl.solana.com/token
```

---

## Step 1: Generate Treasury Keypair

Generate a new Solana keypair for the platform treasury. This wallet will receive the platform's 5% fee from all payments.

```bash
# Create a directory for keys (gitignored)
mkdir -p ~/.clawstack-keys

# Generate the keypair
solana-keygen new --outfile ~/.clawstack-keys/treasury-keypair.json

# Display the public key
solana-keygen pubkey ~/.clawstack-keys/treasury-keypair.json
```

**IMPORTANT SECURITY NOTES:**
- NEVER commit `treasury-keypair.json` to version control
- Store the keypair securely (AWS Secrets Manager, HashiCorp Vault, etc.)
- Keep a secure backup of the seed phrase shown during generation
- Consider using a hardware wallet for production

---

## Step 2: Configure Environment Variables

Add the treasury public key to your environment configuration:

```bash
# .env.local (for local development)
SOLANA_TREASURY_PUBKEY=<your-treasury-public-key>

# Example:
# SOLANA_TREASURY_PUBKEY=CStkPay111111111111111111111111111111111111
```

For production, store in your deployment platform's secrets:
- **Vercel**: Project Settings → Environment Variables
- **AWS**: Secrets Manager or Parameter Store
- **Railway/Render**: Environment Variables section

---

## Step 3: Fund Treasury with SOL

The treasury needs a small amount of SOL for:
- Rent exemption for the USDC token account (~0.002 SOL)
- Transaction fees for future operations

```bash
# Set the keypair as default (temporarily)
solana config set --keypair ~/.clawstack-keys/treasury-keypair.json

# Check current balance
solana balance

# For devnet testing, airdrop SOL
solana config set --url devnet
solana airdrop 1

# For mainnet, transfer SOL from another wallet
# Minimum recommended: 0.01 SOL
```

---

## Step 4: Create USDC Token Account

Create an Associated Token Account (ATA) to receive USDC payments.

### USDC Mint Addresses

| Network | USDC Mint Address |
|---------|-------------------|
| Mainnet | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Devnet  | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

### Create the Token Account

```bash
# For Mainnet
solana config set --url mainnet-beta
spl-token create-account EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --owner $(solana-keygen pubkey ~/.clawstack-keys/treasury-keypair.json)

# For Devnet (testing)
solana config set --url devnet
spl-token create-account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --owner $(solana-keygen pubkey ~/.clawstack-keys/treasury-keypair.json)
```

### Verify Token Account

```bash
# List all token accounts for the treasury
spl-token accounts --owner $(solana-keygen pubkey ~/.clawstack-keys/treasury-keypair.json)

# Check USDC balance
spl-token balance EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --owner $(solana-keygen pubkey ~/.clawstack-keys/treasury-keypair.json)
```

---

## Step 5: Verify Configuration

Run this verification script to ensure everything is set up correctly:

```bash
#!/bin/bash
# verify-treasury.sh

TREASURY_PUBKEY="${SOLANA_TREASURY_PUBKEY}"
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

echo "Verifying treasury setup..."

# Check environment variable
if [ -z "$TREASURY_PUBKEY" ]; then
  echo "❌ SOLANA_TREASURY_PUBKEY not set"
  exit 1
fi
echo "✅ Treasury pubkey: $TREASURY_PUBKEY"

# Check SOL balance
SOL_BALANCE=$(solana balance $TREASURY_PUBKEY 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "❌ Failed to fetch SOL balance"
  exit 1
fi
echo "✅ SOL balance: $SOL_BALANCE"

# Check USDC token account exists
USDC_BALANCE=$(spl-token balance $USDC_MINT --owner $TREASURY_PUBKEY 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "❌ USDC token account not found"
  exit 1
fi
echo "✅ USDC balance: $USDC_BALANCE"

echo ""
echo "🎉 Treasury setup verified successfully!"
```

---

## Security Best Practices

### Key Management

1. **Production Keys**
   - Use a hardware wallet (Ledger) for mainnet treasury
   - Or use a multi-sig wallet (Squads Protocol)
   - Never store private keys in code or config files

2. **Access Control**
   - Limit who has access to treasury keys
   - Use separate keys for devnet/testnet vs mainnet
   - Rotate keys periodically

3. **Monitoring**
   - Set up alerts for large withdrawals
   - Monitor for unauthorized access attempts
   - Keep audit logs of all treasury operations

### Backup Procedures

1. Store seed phrase in multiple secure locations:
   - Hardware security module (HSM)
   - Bank safety deposit box
   - Encrypted cloud backup (with separate encryption key)

2. Test recovery procedure periodically

3. Document recovery process for team members

---

## Troubleshooting

### "Account not found" Error

The treasury address may not have any SOL yet:
```bash
# Check if account exists
solana account $SOLANA_TREASURY_PUBKEY

# Fund with minimal SOL
solana transfer $SOLANA_TREASURY_PUBKEY 0.01 --from <funded-wallet>
```

### "Token account not found" Error

Create the Associated Token Account:
```bash
spl-token create-account EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --owner $SOLANA_TREASURY_PUBKEY \
  --fee-payer <funded-wallet>
```

### RPC Connection Issues

If you're getting timeout errors:
1. Check your `SOLANA_RPC_URL` is valid
2. Try a different RPC provider (Helius, QuickNode, Triton)
3. Ensure you're not being rate-limited

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SOLANA_RPC_URL` | Yes | Primary Solana RPC endpoint |
| `SOLANA_RPC_FALLBACK_URL` | No | Backup RPC endpoint |
| `SOLANA_TREASURY_PUBKEY` | Yes | Treasury wallet public key |
| `USDC_MINT_SOLANA` | Yes | USDC token mint address |

### Example .env.local

```env
# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_RPC_FALLBACK_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY
SOLANA_TREASURY_PUBKEY=CStkPay111111111111111111111111111111111111
USDC_MINT_SOLANA=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

---

## Next Steps

After completing treasury setup:

1. Run the verification script to confirm setup
2. Test with a small USDC transfer on devnet
3. Configure the ClawStack application with the treasury address
4. Set up monitoring and alerting for the treasury wallet
