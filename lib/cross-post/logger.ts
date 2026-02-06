/**
 * Cross-Post Logger
 *
 * Utilities for logging cross-post attempts to the database.
 * Provides an audit trail of all cross-posting activity.
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import type { Platform, CrossPostLog, LogFilters } from './types';

/**
 * Create a new log entry for a cross-post attempt
 *
 * @param postId - Post UUID
 * @param agentId - Agent UUID
 * @param platform - Target platform
 * @param configId - Config UUID (optional)
 * @returns Log ID or null on error
 */
export async function createLog(
  postId: string,
  agentId: string,
  platform: Platform,
  configId?: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('cross_post_logs')
    .insert({
      post_id: postId,
      agent_id: agentId,
      config_id: configId || null,
      platform,
      status: 'pending',
      retry_count: 0,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create cross-post log:', error);
    return null;
  }

  return data.id;
}

/**
 * Update log with successful result
 *
 * @param logId - Log UUID
 * @param externalId - ID of post on external platform
 * @param externalUrl - URL to post on external platform
 */
export async function updateLogSuccess(
  logId: string,
  externalId: string,
  externalUrl: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('cross_post_logs')
    .update({
      status: 'success',
      external_id: externalId,
      external_url: externalUrl,
      completed_at: new Date().toISOString(),
    })
    .eq('id', logId);

  if (error) {
    console.error('Failed to update cross-post log (success):', error);
  }
}

/**
 * Update log with failed result
 *
 * @param logId - Log UUID
 * @param errorMessage - Error description
 * @param retryCount - Number of retries attempted
 */
export async function updateLogFailure(
  logId: string,
  errorMessage: string,
  retryCount: number = 0
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('cross_post_logs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      retry_count: retryCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', logId);

  if (error) {
    console.error('Failed to update cross-post log (failure):', error);
  }
}

/**
 * Get logs for a specific post
 *
 * @param postId - Post UUID
 * @returns Array of logs for the post
 */
export async function getLogsByPost(postId: string): Promise<CrossPostLog[]> {
  const { data, error } = await supabaseAdmin
    .from('cross_post_logs')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get cross-post logs by post:', error);
    return [];
  }

  return data as CrossPostLog[];
}

/**
 * Get logs for an agent with filters
 *
 * @param agentId - Agent UUID
 * @param filters - Query filters
 * @returns Array of logs matching filters
 */
export async function getLogsByAgent(
  agentId: string,
  filters: LogFilters = {}
): Promise<{ logs: CrossPostLog[]; total: number }> {
  const { platform, status, post_id, limit = 50, offset = 0 } = filters;

  // Build count query
  let countQuery = supabaseAdmin
    .from('cross_post_logs')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId);

  if (platform) {
    countQuery = countQuery.eq('platform', platform);
  }
  if (status) {
    countQuery = countQuery.eq('status', status);
  }
  if (post_id) {
    countQuery = countQuery.eq('post_id', post_id);
  }

  const { count } = await countQuery;

  // Build data query
  let dataQuery = supabaseAdmin
    .from('cross_post_logs')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (platform) {
    dataQuery = dataQuery.eq('platform', platform);
  }
  if (status) {
    dataQuery = dataQuery.eq('status', status);
  }
  if (post_id) {
    dataQuery = dataQuery.eq('post_id', post_id);
  }

  const { data, error } = await dataQuery;

  if (error) {
    console.error('Failed to get cross-post logs by agent:', error);
    return { logs: [], total: 0 };
  }

  return {
    logs: data as CrossPostLog[],
    total: count || 0,
  };
}

/**
 * Get count of logs by status for an agent
 *
 * @param agentId - Agent UUID
 * @returns Status counts
 */
export async function getLogStatusCounts(
  agentId: string
): Promise<{ pending: number; success: number; failed: number }> {
  const statuses = ['pending', 'success', 'failed'] as const;
  const counts = { pending: 0, success: 0, failed: 0 };

  for (const status of statuses) {
    const { count } = await supabaseAdmin
      .from('cross_post_logs')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', status);

    counts[status] = count || 0;
  }

  return counts;
}
