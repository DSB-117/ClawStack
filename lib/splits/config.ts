/**
 * 0xSplits Configuration
 *
 * Contract addresses and ABIs for PushSplitFactory and PushSplit on Base.
 * Uses pre-deployed contracts from 0xSplits team.
 */

import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// PushSplitFactoryV2.2 on Base mainnet
export const PUSH_SPLIT_FACTORY_ADDRESS = '0x8E8eB0cC6AE34A38B67D5Cf91ACa38f60bc3Ecf4' as const;

// SplitsWarehouse on Base mainnet
export const SPLITS_WAREHOUSE_ADDRESS = '0x8fb66F38cF86A3d5e8768f8F1754A24A6c661Fb8' as const;

// USDC on Base
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

// Platform treasury
export const PLATFORM_TREASURY_ADDRESS = process.env.BASE_TREASURY_ADDRESS || '0xF1F9448354F99fAe1D29A4c82DC839c16e72AfD5';

// ABI for PushSplitFactory.createSplit
export const PUSH_SPLIT_FACTORY_ABI = [
  {
    type: 'function',
    name: 'createSplit',
    inputs: [
      {
        name: '_splitParams',
        type: 'tuple',
        components: [
          { name: 'recipients', type: 'address[]' },
          { name: 'allocations', type: 'uint256[]' },
          { name: 'totalAllocation', type: 'uint256' },
          { name: 'distributionIncentive', type: 'uint16' },
        ],
      },
      { name: '_owner', type: 'address' },
      { name: '_creator', type: 'address' },
    ],
    outputs: [{ name: 'split', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'SplitCreated',
    inputs: [
      { name: 'split', type: 'address', indexed: true },
      {
        name: 'splitParams',
        type: 'tuple',
        indexed: false,
        components: [
          { name: 'recipients', type: 'address[]' },
          { name: 'allocations', type: 'uint256[]' },
          { name: 'totalAllocation', type: 'uint256' },
          { name: 'distributionIncentive', type: 'uint16' },
        ],
      },
      { name: 'owner', type: 'address', indexed: false },
      { name: 'creator', type: 'address', indexed: false },
      { name: 'nonce', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ABI for PushSplit.distribute
export const PUSH_SPLIT_ABI = [
  {
    type: 'function',
    name: 'distribute',
    inputs: [
      {
        name: '_split',
        type: 'tuple',
        components: [
          { name: 'recipients', type: 'address[]' },
          { name: 'allocations', type: 'uint256[]' },
          { name: 'totalAllocation', type: 'uint256' },
          { name: 'distributionIncentive', type: 'uint16' },
        ],
      },
      { name: '_token', type: 'address' },
      { name: '_distributor', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

/**
 * Get a public client for reading from Base.
 */
export function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
  });
}

/**
 * Get a wallet client for write operations (split creation, distribution).
 * Uses a server-side deployer private key.
 */
export function getWalletClient() {
  const privateKey = process.env.SPLITS_DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error('SPLITS_DEPLOYER_PRIVATE_KEY not set');

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
  });
}
