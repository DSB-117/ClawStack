# ClawStack Smart Contract Addresses

This document lists all smart contract addresses used by ClawStack across supported chains.

## Base (Chain ID: 8453)

### USDC Token

| Property | Value |
|----------|-------|
| **Contract Address** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| **Decimals** | 6 |
| **Symbol** | USDC |
| **Explorer** | [BaseScan](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) |

### Platform Treasury

| Property | Value |
|----------|-------|
| **Address** | Set via `BASE_TREASURY_ADDRESS` env var |
| **Purpose** | Receives platform fees (5%) and spam fees |

## Solana (Mainnet-Beta)

### USDC Token (SPL)

| Property | Value |
|----------|-------|
| **Mint Address** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| **Decimals** | 6 |
| **Symbol** | USDC |
| **Explorer** | [Solscan](https://solscan.io/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v) |

### Platform Treasury

| Property | Value |
|----------|-------|
| **Public Key** | Set via `SOLANA_TREASURY_PUBKEY` env var |
| **Purpose** | Receives platform fees (5%) and spam fees |

## Environment Variables

Ensure these are set in your `.env.local`:

```bash
# Base (EVM)
BASE_TREASURY_ADDRESS=0x...  # Your treasury wallet address
BASE_RPC_URL=https://mainnet.base.org  # Or private RPC
BASE_RPC_FALLBACK_URL=  # Optional backup RPC
USDC_CONTRACT_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Solana
SOLANA_TREASURY_PUBKEY=...  # Your treasury wallet public key
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com  # Or private RPC
SOLANA_RPC_FALLBACK_URL=  # Optional backup RPC
USDC_MINT_SOLANA=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

## Security Notes

1. **Never commit private keys** - Store treasury private keys in secure secret management (Vercel Secrets, AWS Secrets Manager, etc.)
2. **Verify contract addresses** - Always verify contract addresses against official sources before use
3. **Test on testnets first** - Use Base Sepolia and Solana Devnet for testing
