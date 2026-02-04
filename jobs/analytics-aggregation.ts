/**
 * Analytics Aggregation Job
 *
 * Pre-computes analytics metrics for all agents at various time granularities.
 * Runs daily at midnight UTC (or on-demand) to populate analytics_aggregates table.
 *
 * Aggregation periods:
 * - daily: Previous calendar day
 * - weekly: Previous 7 days (rolling)
 * - monthly: Previous 30 days (rolling)
 * - all_time: Lifetime stats
 *
 * @see claude/operations/tasks.md Task 6.1.x
 * @see claude/knowledge/prd.md Section 4.7 analytics_aggregates schema
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import type { AnalyticsAggregateInsert } from '@/types/database';

// ============================================
// Configuration
// ============================================

/** Period types supported by the aggregation system */
export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'all_time';

/** Maximum number of top posts to include in the aggregate */
const MAX_TOP_POSTS = 10;

/** USDC decimals (6) for display conversion */
// const USDC_DECIMALS = 6;

// ============================================
// Types
// ============================================

interface TopPost {
  post_id: string;
  title: string;
  views: number;
  paid_views: number;
  earnings_raw: number;
}

interface AgentAggregateData {
  agent_id: string;
  total_views: number;
  paid_views: number;
  free_views: number;
  earnings_solana_raw: bigint;
  earnings_base_raw: bigint;
  new_subscribers: number;
  lost_subscribers: number;
  total_subscribers: number;
  posts_published: number;
  top_posts: TopPost[];
}

interface AggregationResult {
  period_type: PeriodType;
  period_start: Date;
  period_end: Date | null;
  agents_processed: number;
  errors: Array<{ agent_id: string; error: string }>;
  duration_ms: number;
}

interface DateRange {
  start: Date;
  end: Date;
}

// ============================================
// Date Utilities
// ============================================

/**
 * Get the date range for a specific aggregation period.
 * Uses UTC dates for consistency.
 */
export function getDateRange(periodType: PeriodType, referenceDate?: Date): DateRange {
  const now = referenceDate || new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  switch (periodType) {
    case 'daily': {
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 1);
      const dayEnd = new Date(end);
      dayEnd.setUTCMilliseconds(-1);
      return { start, end: dayEnd };
    }
    case 'weekly': {
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 7);
      const weekEnd = new Date(end);
      weekEnd.setUTCMilliseconds(-1);
      return { start, end: weekEnd };
    }
    case 'monthly': {
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 30);
      const monthEnd = new Date(end);
      monthEnd.setUTCMilliseconds(-1);
      return { start, end: monthEnd };
    }
    case 'all_time': {
      // Start from Unix epoch for all-time
      return {
        start: new Date('1970-01-01T00:00:00Z'),
        end: new Date(),
      };
    }
  }
}

/**
 * Format date as ISO date string (YYYY-MM-DD) for database storage.
 */
function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================
// Data Fetching Functions
// ============================================

/**
 * Fetch all active agent IDs for aggregation.
 */
async function fetchAllAgentIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id')
    .neq('reputation_tier', 'suspended');

  if (error) {
    throw new Error(`Failed to fetch agents: ${error.message}`);
  }

  return data.map((agent) => agent.id);
}

/**
 * Calculate total views for an agent within a date range.
 * Task 6.1.3: Calculate total views per agent
 */
async function calculateViews(
  agentId: string,
  startDate: Date,
  endDate: Date
): Promise<{ total_views: number; paid_views: number; free_views: number }> {
  // Get view counts from posts created/published in the period
  const { data: posts, error } = await supabaseAdmin
    .from('posts')
    .select('view_count, paid_view_count, is_paid')
    .eq('author_id', agentId)
    .eq('status', 'published')
    .gte('published_at', startDate.toISOString())
    .lte('published_at', endDate.toISOString());

  if (error) {
    throw new Error(`Failed to fetch views for agent ${agentId}: ${error.message}`);
  }

  let total_views = 0;
  let paid_views = 0;
  let free_views = 0;

  for (const post of posts || []) {
    total_views += post.view_count || 0;
    paid_views += post.paid_view_count || 0;
    free_views += (post.view_count || 0) - (post.paid_view_count || 0);
  }

  return { total_views, paid_views, free_views };
}

/**
 * Calculate earnings by chain for an agent within a date range.
 * Task 6.1.4: Calculate earnings by chain
 */
async function calculateEarnings(
  agentId: string,
  startDate: Date,
  endDate: Date
): Promise<{ solana_raw: bigint; base_raw: bigint }> {
  // Get confirmed payment events where agent is the recipient
  const { data: payments, error } = await supabaseAdmin
    .from('payment_events')
    .select('network, author_amount_raw')
    .eq('recipient_id', agentId)
    .eq('status', 'confirmed')
    .in('resource_type', ['post', 'subscription'])
    .gte('verified_at', startDate.toISOString())
    .lte('verified_at', endDate.toISOString());

  if (error) {
    throw new Error(`Failed to fetch earnings for agent ${agentId}: ${error.message}`);
  }

  let solana_raw = BigInt(0);
  let base_raw = BigInt(0);

  for (const payment of payments || []) {
    const amount = BigInt(payment.author_amount_raw || 0);
    if (payment.network === 'solana') {
      solana_raw += amount;
    } else if (payment.network === 'base') {
      base_raw += amount;
    }
  }

  return { solana_raw, base_raw };
}

/**
 * Calculate subscriber metrics for an agent within a date range.
 * Task 6.1.5: Calculate subscriber counts
 */
async function calculateSubscribers(
  agentId: string,
  startDate: Date,
  endDate: Date
): Promise<{ new_subscribers: number; lost_subscribers: number; total_subscribers: number }> {
  // Count new subscriptions in period
  const { count: newCount, error: newError } = await supabaseAdmin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', agentId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (newError) {
    throw new Error(`Failed to fetch new subscribers: ${newError.message}`);
  }

  // Count cancelled subscriptions in period
  const { count: lostCount, error: lostError } = await supabaseAdmin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', agentId)
    .eq('status', 'cancelled')
    .gte('cancelled_at', startDate.toISOString())
    .lte('cancelled_at', endDate.toISOString());

  if (lostError) {
    throw new Error(`Failed to fetch lost subscribers: ${lostError.message}`);
  }

  // Count total active subscribers (as of end date)
  const { count: totalCount, error: totalError } = await supabaseAdmin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', agentId)
    .eq('status', 'active')
    .lte('created_at', endDate.toISOString());

  if (totalError) {
    throw new Error(`Failed to fetch total subscribers: ${totalError.message}`);
  }

  return {
    new_subscribers: newCount || 0,
    lost_subscribers: lostCount || 0,
    total_subscribers: totalCount || 0,
  };
}

/**
 * Get posts published count in period.
 */
async function calculatePostsPublished(
  agentId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', agentId)
    .eq('status', 'published')
    .gte('published_at', startDate.toISOString())
    .lte('published_at', endDate.toISOString());

  if (error) {
    throw new Error(`Failed to count posts: ${error.message}`);
  }

  return count || 0;
}

/**
 * Identify top performing posts for an agent in a date range.
 * Task 6.1.6: Identify top performing posts
 */
async function getTopPosts(
  agentId: string,
  startDate: Date,
  endDate: Date
): Promise<TopPost[]> {
  // Get posts with their payment earnings
  const { data: posts, error: postsError } = await supabaseAdmin
    .from('posts')
    .select('id, title, view_count, paid_view_count')
    .eq('author_id', agentId)
    .eq('status', 'published')
    .gte('published_at', startDate.toISOString())
    .lte('published_at', endDate.toISOString())
    .order('view_count', { ascending: false })
    .limit(MAX_TOP_POSTS * 2); // Get extra for filtering

  if (postsError) {
    throw new Error(`Failed to fetch top posts: ${postsError.message}`);
  }

  if (!posts || posts.length === 0) {
    return [];
  }

  // Get earnings for each post
  const topPosts: TopPost[] = [];

  for (const post of posts) {
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('payment_events')
      .select('author_amount_raw')
      .eq('resource_type', 'post')
      .eq('resource_id', post.id)
      .eq('status', 'confirmed')
      .gte('verified_at', startDate.toISOString())
      .lte('verified_at', endDate.toISOString());

    if (earningsError) {
      console.warn(`Failed to fetch earnings for post ${post.id}: ${earningsError.message}`);
      continue;
    }

    const totalEarnings = (earnings || []).reduce(
      (sum, e) => sum + (e.author_amount_raw || 0),
      0
    );

    topPosts.push({
      post_id: post.id,
      title: post.title,
      views: post.view_count || 0,
      paid_views: post.paid_view_count || 0,
      earnings_raw: totalEarnings,
    });
  }

  // Sort by earnings (descending) and take top N
  return topPosts
    .sort((a, b) => b.earnings_raw - a.earnings_raw || b.views - a.views)
    .slice(0, MAX_TOP_POSTS);
}

// ============================================
// Aggregation Core Functions
// ============================================

/**
 * Aggregate all metrics for a single agent.
 */
async function aggregateAgentData(
  agentId: string,
  startDate: Date,
  endDate: Date
): Promise<AgentAggregateData> {
  const [views, earnings, subscribers, postsPublished, topPosts] = await Promise.all([
    calculateViews(agentId, startDate, endDate),
    calculateEarnings(agentId, startDate, endDate),
    calculateSubscribers(agentId, startDate, endDate),
    calculatePostsPublished(agentId, startDate, endDate),
    getTopPosts(agentId, startDate, endDate),
  ]);

  return {
    agent_id: agentId,
    total_views: views.total_views,
    paid_views: views.paid_views,
    free_views: views.free_views,
    earnings_solana_raw: earnings.solana_raw,
    earnings_base_raw: earnings.base_raw,
    new_subscribers: subscribers.new_subscribers,
    lost_subscribers: subscribers.lost_subscribers,
    total_subscribers: subscribers.total_subscribers,
    posts_published: postsPublished,
    top_posts: topPosts,
  };
}

/**
 * Upsert an analytics aggregate record.
 * Uses UPSERT to handle re-runs gracefully.
 */
async function upsertAggregate(
  agentId: string,
  periodType: PeriodType,
  periodStart: Date,
  periodEnd: Date | null,
  data: AgentAggregateData
): Promise<void> {
  const record: AnalyticsAggregateInsert = {
    agent_id: agentId,
    period_type: periodType,
    period_start: toDateString(periodStart),
    period_end: periodEnd ? toDateString(periodEnd) : null,
    total_views: data.total_views,
    paid_views: data.paid_views,
    free_views: data.free_views,
    earnings_solana_raw: Number(data.earnings_solana_raw),
    earnings_base_raw: Number(data.earnings_base_raw),
    new_subscribers: data.new_subscribers,
    lost_subscribers: data.lost_subscribers,
    total_subscribers: data.total_subscribers,
    posts_published: data.posts_published,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    top_posts: data.top_posts as any, // Cast to any to satisfy Json type
    calculated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from('analytics_aggregates')
    .upsert(record, {
      onConflict: 'agent_id,period_type,period_start',
    });

  if (error) {
    throw new Error(`Failed to upsert aggregate: ${error.message}`);
  }
}

// ============================================
// Main Aggregation Jobs
// ============================================

/**
 * Run aggregation for a specific period type.
 * Task 6.1.2, 6.1.7, 6.1.8, 6.1.9: Implement period-specific aggregation
 */
export async function runAggregation(
  periodType: PeriodType,
  referenceDate?: Date
): Promise<AggregationResult> {
  const startTime = Date.now();
  const { start, end } = getDateRange(periodType, referenceDate);
  const errors: Array<{ agent_id: string; error: string }> = [];

  console.log(`[Analytics] Starting ${periodType} aggregation for ${toDateString(start)} to ${toDateString(end)}`);

  // Fetch all agent IDs
  const agentIds = await fetchAllAgentIds();
  console.log(`[Analytics] Processing ${agentIds.length} agents`);

  // Process each agent
  for (const agentId of agentIds) {
    try {
      const data = await aggregateAgentData(agentId, start, end);
      await upsertAggregate(
        agentId,
        periodType,
        start,
        periodType === 'all_time' ? null : end,
        data
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Analytics] Error processing agent ${agentId}: ${errorMessage}`);
      errors.push({ agent_id: agentId, error: errorMessage });
    }
  }

  const duration_ms = Date.now() - startTime;
  console.log(
    `[Analytics] Completed ${periodType} aggregation. Agents: ${agentIds.length}, Errors: ${errors.length}, Duration: ${duration_ms}ms`
  );

  return {
    period_type: periodType,
    period_start: start,
    period_end: periodType === 'all_time' ? null : end,
    agents_processed: agentIds.length,
    errors,
    duration_ms,
  };
}

/**
 * Task 6.1.2: Run daily aggregation job.
 * Designed to run at midnight UTC.
 */
export async function runDailyAggregation(referenceDate?: Date): Promise<AggregationResult> {
  return runAggregation('daily', referenceDate);
}

/**
 * Task 6.1.7: Run weekly aggregation job.
 * Aggregates rolling 7-day metrics.
 */
export async function runWeeklyAggregation(referenceDate?: Date): Promise<AggregationResult> {
  return runAggregation('weekly', referenceDate);
}

/**
 * Task 6.1.8: Run monthly aggregation job.
 * Aggregates rolling 30-day metrics.
 */
export async function runMonthlyAggregation(referenceDate?: Date): Promise<AggregationResult> {
  return runAggregation('monthly', referenceDate);
}

/**
 * Task 6.1.9: Run all-time rollup.
 * Aggregates lifetime statistics for all agents.
 */
export async function runAllTimeAggregation(referenceDate?: Date): Promise<AggregationResult> {
  return runAggregation('all_time', referenceDate);
}

/**
 * Run all aggregation periods.
 * Typically called by a cron job at midnight UTC.
 */
export async function runAllAggregations(
  referenceDate?: Date
): Promise<Record<PeriodType, AggregationResult>> {
  const results: Record<PeriodType, AggregationResult> = {} as Record<PeriodType, AggregationResult>;

  // Run in sequence to avoid overwhelming the database
  results.daily = await runDailyAggregation(referenceDate);
  results.weekly = await runWeeklyAggregation(referenceDate);
  results.monthly = await runMonthlyAggregation(referenceDate);
  results.all_time = await runAllTimeAggregation(referenceDate);

  return results;
}

// ============================================
// CLI Entry Point
// ============================================

/**
 * Execute aggregation from command line.
 * Usage: npx ts-node jobs/analytics-aggregation.ts [period]
 * Period: daily | weekly | monthly | all_time | all (default: all)
 */
async function main(): Promise<void> {
  const period = (process.argv[2] || 'all') as PeriodType | 'all';

  console.log(`[Analytics] Starting aggregation job: ${period}`);
  const startTime = Date.now();

  try {
    if (period === 'all') {
      const results = await runAllAggregations();
      console.log('\n[Analytics] All aggregations complete:');
      for (const [type, result] of Object.entries(results)) {
        console.log(
          `  ${type}: ${result.agents_processed} agents, ${result.errors.length} errors, ${result.duration_ms}ms`
        );
      }
    } else if (['daily', 'weekly', 'monthly', 'all_time'].includes(period)) {
      const result = await runAggregation(period);
      console.log(`\n[Analytics] ${period} aggregation complete:`);
      console.log(`  Agents processed: ${result.agents_processed}`);
      console.log(`  Errors: ${result.errors.length}`);
      console.log(`  Duration: ${result.duration_ms}ms`);
    } else {
      console.error(`Invalid period: ${period}. Use: daily, weekly, monthly, all_time, or all`);
      process.exit(1);
    }

    const totalDuration = Date.now() - startTime;
    console.log(`\n[Analytics] Job completed in ${totalDuration}ms`);
    process.exit(0);
  } catch (error) {
    console.error('[Analytics] Fatal error:', error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (require.main === module) {
  main();
}
