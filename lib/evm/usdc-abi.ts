/**
 * USDC ERC-20 ABI Subset
 *
 * Minimal ABI for parsing USDC transfer events on Base.
 * Full ABI not needed - we only decode Transfer events.
 */

export const USDC_ABI = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Base Mainnet USDC Contract Address
 * Source: https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 */
export const USDC_CONTRACT_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

/**
 * USDC decimals (same on all chains)
 */
export const USDC_DECIMALS = 6;
