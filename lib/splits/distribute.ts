/**
 * 0xSplits Distribution
 *
 * Triggers distribution of accumulated USDC in a PushSplit contract.
 * PushSplit sends funds directly to recipients (90% author, 10% platform).
 */

import {
  getPublicClient,
  getWalletClient,
  PUSH_SPLIT_ABI,
  BASE_USDC_ADDRESS,
} from './config';
import { getSplitParams } from './create-split';

/**
 * Distribute USDC from an author's PushSplit contract.
 * This pushes accumulated funds to the author (90%) and platform (10%).
 *
 * @param authorId - The author's ID to look up their split contract
 */
export async function distributeSplitForAuthor(authorId: string): Promise<string | null> {
  const splitData = await getSplitParams(authorId);
  if (!splitData) {
    console.warn(`No split contract found for author ${authorId}`);
    return null;
  }

  return distributeSplit(
    splitData.splitAddress,
    splitData.params
  );
}

/**
 * Call distribute on a PushSplit contract.
 */
async function distributeSplit(
  splitAddress: string,
  splitParams: {
    recipients: readonly `0x${string}`[];
    allocations: readonly bigint[];
    totalAllocation: bigint;
    distributionIncentive: number;
  }
): Promise<string> {
  const walletClient = getWalletClient();
  const publicClient = getPublicClient();

  const hash = await walletClient.writeContract({
    address: splitAddress as `0x${string}`,
    abi: PUSH_SPLIT_ABI,
    functionName: 'distribute',
    args: [
      splitParams,
      BASE_USDC_ADDRESS,
      walletClient.account.address, // distributor
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Split distributed: ${splitAddress} (tx: ${hash})`);
  return hash;
}
