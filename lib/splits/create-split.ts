/**
 * Create and cache 0xSplits PushSplit contracts for authors.
 *
 * Each author gets a unique PushSplit contract that splits incoming funds:
 * - 90% to the author
 * - 10% to the ClawStack platform treasury
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import {
  getPublicClient,
  getWalletClient,
  PUSH_SPLIT_FACTORY_ADDRESS,
  PUSH_SPLIT_FACTORY_ABI,
  PLATFORM_TREASURY_ADDRESS,
} from './config';
import { decodeEventLog, encodeFunctionData } from 'viem';

interface CreateSplitParams {
  authorId: string;
  authorAddress: string;
}

/**
 * Get or create a split address for an author.
 * Checks database first, creates on-chain if not found.
 */
export async function getOrCreateAuthorSplit(params: CreateSplitParams): Promise<string> {
  // 1. Check if split already exists in DB
  const { data: existing } = await supabaseAdmin
    .from('author_splits')
    .select('split_address')
    .eq('author_id', params.authorId)
    .eq('chain', 'base')
    .single();

  if (existing?.split_address) return existing.split_address;

  // 2. Create split on-chain
  const splitAddress = await deployPushSplit(params.authorAddress);

  // 3. Store in database
  await supabaseAdmin.from('author_splits').insert({
    author_id: params.authorId,
    split_address: splitAddress,
    author_address: params.authorAddress,
    platform_address: PLATFORM_TREASURY_ADDRESS,
    author_percentage: 90.00,
    platform_percentage: 10.00,
    chain: 'base',
    chain_id: '8453',
  });

  return splitAddress;
}

/**
 * Deploy a PushSplit contract for an author via PushSplitFactoryV2.2.
 * @deprecated Use buildSplitCalldata + agent signing instead.
 */
async function deployPushSplit(authorAddress: string): Promise<string> {
  const walletClient = getWalletClient();
  const publicClient = getPublicClient();

  const recipients = buildSplitRecipients(authorAddress);

  const splitParams = {
    recipients: recipients.map(r => r.address as `0x${string}`),
    allocations: recipients.map(r => r.allocation),
    totalAllocation: 1000000n,
    distributionIncentive: 0, // no distributor fee
  };

  const hash = await walletClient.writeContract({
    address: PUSH_SPLIT_FACTORY_ADDRESS,
    abi: PUSH_SPLIT_FACTORY_ABI,
    functionName: 'createSplit',
    args: [
      splitParams,
      walletClient.account.address, // owner
      walletClient.account.address, // creator
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Parse the SplitCreated event to get the split address
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: PUSH_SPLIT_FACTORY_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === 'SplitCreated') {
        const splitAddress = (decoded.args as { split: string }).split;
        console.log(`PushSplit deployed at ${splitAddress} for author ${authorAddress}`);
        return splitAddress;
      }
    } catch {
      // Not the event we're looking for
      continue;
    }
  }

  throw new Error('SplitCreated event not found in transaction receipt');
}

/**
 * Build the sorted split recipients for an author.
 * Shared by deployment, calldata building, and verification.
 */
function buildSplitRecipients(authorAddress: string) {
  return [
    { address: authorAddress.toLowerCase(), allocation: 900000n }, // 90%
    { address: PLATFORM_TREASURY_ADDRESS.toLowerCase(), allocation: 100000n }, // 10%
  ].sort((a, b) => a.address.localeCompare(b.address));
}

/**
 * Build unsigned createSplit calldata for the PushSplitFactory.
 * Returns { to, data } suitable for an agent to sign and submit.
 */
export function buildSplitCalldata(authorAddress: string): { to: string; data: string } {
  const recipients = buildSplitRecipients(authorAddress);
  const normalizedAuthor = authorAddress.toLowerCase() as `0x${string}`;

  const splitParams = {
    recipients: recipients.map(r => r.address as `0x${string}`),
    allocations: recipients.map(r => r.allocation),
    totalAllocation: 1000000n,
    distributionIncentive: 0,
  };

  const data = encodeFunctionData({
    abi: PUSH_SPLIT_FACTORY_ABI,
    functionName: 'createSplit',
    args: [
      splitParams,
      normalizedAuthor, // owner = author
      normalizedAuthor, // creator = author
    ],
  });

  return {
    to: PUSH_SPLIT_FACTORY_ADDRESS,
    data,
  };
}

/**
 * Verify a split deployment transaction and extract the split address.
 * Validates that the SplitCreated event exists and recipients match expected params.
 */
export async function verifySplitDeployment(
  txHash: string,
  expectedAuthor: string
): Promise<{ splitAddress: string }> {
  const publicClient = getPublicClient();

  const receipt = await publicClient.getTransactionReceipt({
    hash: txHash as `0x${string}`,
  });

  if (!receipt || receipt.status === 'reverted') {
    throw new Error('Transaction failed or not found');
  }

  // Parse the SplitCreated event
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: PUSH_SPLIT_FACTORY_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === 'SplitCreated') {
        const args = decoded.args as unknown as {
          split: string;
          splitParams: {
            recipients: string[];
            allocations: bigint[];
            totalAllocation: bigint;
            distributionIncentive: number;
          };
        };

        // Validate recipients match expected params
        const expectedRecipients = buildSplitRecipients(expectedAuthor);
        const actualRecipients = args.splitParams.recipients.map(r => r.toLowerCase());
        const expectedAddresses = expectedRecipients.map(r => r.address);

        if (actualRecipients.length !== expectedAddresses.length) {
          throw new Error('Split recipient count mismatch');
        }

        for (let i = 0; i < actualRecipients.length; i++) {
          if (actualRecipients[i] !== expectedAddresses[i]) {
            throw new Error('Split recipient address mismatch');
          }
        }

        // Validate allocations
        const expectedAllocations = expectedRecipients.map(r => r.allocation);
        for (let i = 0; i < args.splitParams.allocations.length; i++) {
          if (args.splitParams.allocations[i] !== expectedAllocations[i]) {
            throw new Error('Split allocation mismatch');
          }
        }

        return { splitAddress: args.split };
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('mismatch')) throw e;
      continue;
    }
  }

  throw new Error('SplitCreated event not found in transaction receipt');
}

/**
 * Get the split parameters for an author's split contract.
 * Needed for calling distribute().
 */
export async function getSplitParams(authorId: string) {
  const { data } = await supabaseAdmin
    .from('author_splits')
    .select('split_address, author_address, platform_address')
    .eq('author_id', authorId)
    .eq('chain', 'base')
    .single();

  if (!data) return null;

  // Reconstruct the split params using the STORED addresses (must match deployment)
  // Do NOT use buildSplitRecipients here — it uses the current env treasury address,
  // which may differ from the address the split was actually deployed with.
  const recipients = [
    { address: data.author_address.toLowerCase(), allocation: 900000n },
    { address: data.platform_address.toLowerCase(), allocation: 100000n },
  ].sort((a, b) => a.address.localeCompare(b.address));

  return {
    splitAddress: data.split_address,
    params: {
      recipients: recipients.map(r => r.address as `0x${string}`),
      allocations: recipients.map(r => r.allocation),
      totalAllocation: 1000000n,
      distributionIncentive: 0,
    },
  };
}
