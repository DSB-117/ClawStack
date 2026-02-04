/**
 * Solana Author Payout Job
 *
 * Processes batched USDC payouts to authors on Solana.
 * Runs weekly (or on-demand) to aggregate small payments into larger batches.
 *
 * @see claude/operations/tasks.md Task 2.4.6
 * @see docs/solana-splitter-program.md
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { supabaseAdmin } from '@/lib/db/supabase-server';

// ============================================
// Configuration
// ============================================

/** Minimum payout threshold in raw units ($1 = 1,000,000) */
const MIN_PAYOUT_RAW = BigInt(1_000_000);

/** Maximum payouts per batch (to avoid transaction size limits) */
const MAX_PAYOUTS_PER_BATCH = 20;

/** Solana commitment level for transactions */
const COMMITMENT = 'confirmed' as const;

/** USDC mint address on Solana mainnet */
const USDC_MINT = new PublicKey(
  process.env.USDC_MINT_SOLANA || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);

// ============================================
// Types
// ============================================

interface PendingPayout {
  author_id: string;
  author_wallet: string;
  total_owed_raw: number;
  payment_count: number;
}

interface PayoutResult {
  author_id: string;
  success: boolean;
  transaction_signature?: string;
  error?: string;
}

interface BatchResult {
  batch_id: string;
  network: 'solana';
  total_authors: number;
  total_amount_raw: bigint;
  successful: number;
  failed: number;
  results: PayoutResult[];
}

// ============================================
// Treasury Keypair Loading
// ============================================

/**
 * Load the treasury keypair from environment.
 * In production, this should come from a secure secret manager.
 */
function loadTreasuryKeypair(): Keypair {
  const secretKey = process.env.SOLANA_TREASURY_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      'SOLANA_TREASURY_SECRET_KEY environment variable is required for payouts'
    );
  }

  try {
    // Expect base64 or JSON array format
    let keyArray: number[];

    if (secretKey.startsWith('[')) {
      keyArray = JSON.parse(secretKey);
    } else {
      keyArray = Array.from(Buffer.from(secretKey, 'base64'));
    }

    return Keypair.fromSecretKey(new Uint8Array(keyArray));
  } catch (error) {
    throw new Error(`Failed to parse treasury keypair: ${error}`);
  }
}

// ============================================
// Payout Processing
// ============================================

/**
 * Get pending payouts from the database.
 * Queries payment_events directly since RPC functions aren't typed.
 */
async function getPendingPayouts(): Promise<PendingPayout[]> {
  // Query confirmed payments grouped by recipient
  const { data, error } = await supabaseAdmin
    .from('payment_events')
    .select(`
      recipient_id,
      author_amount_raw,
      agents!payment_events_recipient_id_fkey(wallet_solana)
    `)
    .eq('network', 'solana')
    .eq('status', 'confirmed')
    .in('resource_type', ['post', 'subscription']);

  if (error) {
    throw new Error(`Failed to fetch pending payouts: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Aggregate by recipient
  const payoutMap = new Map<string, PendingPayout>();

  for (const row of data) {
    const agent = row.agents as unknown as { wallet_solana: string | null };
    if (!agent?.wallet_solana) continue;

    const existing = payoutMap.get(row.recipient_id);
    if (existing) {
      existing.total_owed_raw += row.author_amount_raw;
      existing.payment_count += 1;
    } else {
      payoutMap.set(row.recipient_id, {
        author_id: row.recipient_id,
        author_wallet: agent.wallet_solana,
        total_owed_raw: row.author_amount_raw,
        payment_count: 1,
      });
    }
  }

  // Filter by minimum payout and limit
  return Array.from(payoutMap.values())
    .filter((p) => BigInt(p.total_owed_raw) >= MIN_PAYOUT_RAW)
    .slice(0, MAX_PAYOUTS_PER_BATCH);
}

/**
 * Get unpaid payment event IDs for an author.
 */
async function getUnpaidPaymentEvents(
  authorId: string
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('payment_events')
    .select('id')
    .eq('recipient_id', authorId)
    .eq('network', 'solana')
    .eq('status', 'confirmed')
    .in('resource_type', ['post', 'subscription']);

  if (error) {
    console.error(`Failed to get payment events for ${authorId}:`, error);
    return [];
  }

  return (data || []).map((row) => row.id);
}

/**
 * Create a payout batch record.
 */
async function createPayoutBatch(
  payouts: PendingPayout[]
): Promise<string> {
  const totalAmountRaw = payouts.reduce(
    (sum, p) => sum + BigInt(p.total_owed_raw),
    BigInt(0)
  );

  const { data, error } = await supabaseAdmin
    .from('payout_batches')
    .insert({
      network: 'solana',
      status: 'processing',
      total_authors: payouts.length,
      total_amount_raw: Number(totalAmountRaw),
      started_at: new Date().toISOString(),
      created_by: 'system',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create payout batch: ${error.message}`);
  }

  return data.id;
}

/**
 * Create payout batch item records.
 */
async function createPayoutItems(
  batchId: string,
  payouts: PendingPayout[]
): Promise<void> {
  const items = await Promise.all(
    payouts.map(async (payout) => {
      const paymentEventIds = await getUnpaidPaymentEvents(payout.author_id);

      return {
        batch_id: batchId,
        author_id: payout.author_id,
        author_wallet: payout.author_wallet,
        amount_raw: payout.total_owed_raw,
        payment_event_ids: paymentEventIds,
        status: 'pending' as const,
      };
    })
  );

  const { error } = await supabaseAdmin
    .from('payout_batch_items')
    .insert(items);

  if (error) {
    throw new Error(`Failed to create payout items: ${error.message}`);
  }
}

/**
 * Process a single payout transaction.
 */
async function processPayoutTransaction(
  connection: Connection,
  treasuryKeypair: Keypair,
  authorWallet: string,
  amountRaw: bigint
): Promise<{ signature: string }> {
  const treasuryPubkey = treasuryKeypair.publicKey;
  const authorPubkey = new PublicKey(authorWallet);

  // Get Associated Token Accounts
  const treasuryAta = await getAssociatedTokenAddress(
    USDC_MINT,
    treasuryPubkey
  );
  const authorAta = await getAssociatedTokenAddress(
    USDC_MINT,
    authorPubkey
  );

  // Verify treasury has sufficient balance
  const treasuryAccount = await getAccount(connection, treasuryAta);
  if (treasuryAccount.amount < amountRaw) {
    throw new Error(
      `Insufficient treasury balance: ${treasuryAccount.amount} < ${amountRaw}`
    );
  }

  // Build transfer instruction
  const transferIx = createTransferInstruction(
    treasuryAta,
    authorAta,
    treasuryPubkey,
    amountRaw,
    [],
    TOKEN_PROGRAM_ID
  );

  // Create and send transaction
  const transaction = new Transaction().add(transferIx);
  transaction.feePayer = treasuryPubkey;

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [treasuryKeypair],
    { commitment: COMMITMENT }
  );

  return { signature };
}

/**
 * Update payout item status after processing.
 */
async function updatePayoutItemStatus(
  itemId: string,
  result: PayoutResult
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('payout_batch_items')
    .update({
      status: result.success ? 'completed' : 'failed',
      transaction_signature: result.transaction_signature,
      error_message: result.error,
      processed_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) {
    console.error(`Failed to update payout item ${itemId}:`, error);
  }
}

/**
 * Update payout batch status after completion.
 */
async function updatePayoutBatchStatus(
  batchId: string,
  successful: number,
  failed: number,
  error?: string
): Promise<void> {
  const status =
    failed === 0 ? 'completed' : successful === 0 ? 'failed' : 'partial';

  const { error: updateError } = await supabaseAdmin
    .from('payout_batches')
    .update({
      status,
      successful_payouts: successful,
      failed_payouts: failed,
      completed_at: new Date().toISOString(),
      error_message: error,
    })
    .eq('id', batchId);

  if (updateError) {
    console.error(`Failed to update batch ${batchId}:`, updateError);
  }
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Process all pending Solana payouts.
 *
 * This function:
 * 1. Fetches all authors with pending payouts >= $1
 * 2. Creates a payout batch record
 * 3. Processes each payout as a separate transaction
 * 4. Records results in the database
 *
 * @returns BatchResult with summary of the payout run
 */
export async function processSolanaPayouts(): Promise<BatchResult | null> {
  console.log('Starting Solana payout job...');

  // Fetch pending payouts
  const pendingPayouts = await getPendingPayouts();

  if (pendingPayouts.length === 0) {
    console.log('No pending payouts found');
    return null;
  }

  console.log(`Found ${pendingPayouts.length} authors with pending payouts`);

  // Create batch record
  const batchId = await createPayoutBatch(pendingPayouts);
  console.log(`Created payout batch: ${batchId}`);

  // Create batch items
  await createPayoutItems(batchId, pendingPayouts);

  // Get batch items with IDs
  const { data: batchItems } = await supabaseAdmin
    .from('payout_batch_items')
    .select('id, author_id, author_wallet, amount_raw')
    .eq('batch_id', batchId);

  if (!batchItems || batchItems.length === 0) {
    throw new Error('Failed to retrieve batch items');
  }

  // Load treasury keypair
  const treasuryKeypair = loadTreasuryKeypair();
  console.log(`Treasury pubkey: ${treasuryKeypair.publicKey.toBase58()}`);

  // Connect to Solana
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    COMMITMENT
  );

  // Process each payout
  const results: PayoutResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const item of batchItems) {
    console.log(
      `Processing payout to ${item.author_wallet}: ${item.amount_raw} raw units`
    );

    try {
      const { signature } = await processPayoutTransaction(
        connection,
        treasuryKeypair,
        item.author_wallet,
        BigInt(item.amount_raw)
      );

      const result: PayoutResult = {
        author_id: item.author_id,
        success: true,
        transaction_signature: signature,
      };

      results.push(result);
      await updatePayoutItemStatus(item.id, result);
      successful++;

      console.log(`  ✓ Payout successful: ${signature}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const result: PayoutResult = {
        author_id: item.author_id,
        success: false,
        error: errorMessage,
      };

      results.push(result);
      await updatePayoutItemStatus(item.id, result);
      failed++;

      console.error(`  ✗ Payout failed: ${errorMessage}`);
    }
  }

  // Update batch status
  await updatePayoutBatchStatus(batchId, successful, failed);

  const totalAmountRaw = pendingPayouts.reduce(
    (sum, p) => sum + BigInt(p.total_owed_raw),
    BigInt(0)
  );

  const batchResult: BatchResult = {
    batch_id: batchId,
    network: 'solana',
    total_authors: pendingPayouts.length,
    total_amount_raw: totalAmountRaw,
    successful,
    failed,
    results,
  };

  console.log(`\nPayout batch complete:`);
  console.log(`  Batch ID: ${batchId}`);
  console.log(`  Total: ${pendingPayouts.length} authors`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Failed: ${failed}`);
  console.log(
    `  Total amount: ${Number(totalAmountRaw) / 1_000_000} USDC`
  );

  return batchResult;
}

/**
 * Dry run - preview what would be paid out without executing transactions.
 */
export async function previewSolanaPayouts(): Promise<PendingPayout[]> {
  const pendingPayouts = await getPendingPayouts();

  console.log('Pending Solana Payouts Preview:');
  console.log('================================');

  let totalRaw = BigInt(0);

  for (const payout of pendingPayouts) {
    const amountUsdc = Number(payout.total_owed_raw) / 1_000_000;
    console.log(
      `  ${payout.author_wallet.slice(0, 8)}... : $${amountUsdc.toFixed(2)} (${payout.payment_count} payments)`
    );
    totalRaw += BigInt(payout.total_owed_raw);
  }

  console.log('--------------------------------');
  console.log(`Total: $${(Number(totalRaw) / 1_000_000).toFixed(2)} USDC`);
  console.log(`Authors: ${pendingPayouts.length}`);

  return pendingPayouts;
}

// Export for CLI usage
export { getPendingPayouts, MIN_PAYOUT_RAW, MAX_PAYOUTS_PER_BATCH };
