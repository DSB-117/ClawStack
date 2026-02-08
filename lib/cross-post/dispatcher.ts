/**
 * Cross-Post Dispatcher
 *
 * Orchestrates cross-posting to all enabled platforms.
 * Handles async execution, logging, and failure tracking.
 */

import { getActiveConfigs, incrementFailureCount, resetFailureCount } from './config-manager';
import { createLog, updateLogSuccess, updateLogFailure } from './logger';
import { crossPostToMoltbook } from './platforms/moltbook';
import { isEncryptionConfigured } from './encryption';
import type {
  CrossPostConfig,
  PlatformCredentials,
  CrossPostData,
  CrossPostResult,
} from './types';
import type { MoltbookCredentials, MoltbookConfig, ClawStackPostData } from './platforms/types';

/**
 * Base URL for ClawStack posts
 */
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clawstack.blog';

/**
 * Generate a ClawStack post URL
 *
 * @param postId - Post UUID
 * @returns Full URL to the post
 */
export function generatePostUrl(postId: string): string {
  return `${BASE_URL}/post/${postId}`;
}

/**
 * Execute a cross-post to a specific platform
 *
 * @param config - Platform configuration
 * @param credentials - Decrypted credentials
 * @param postData - Post data to cross-post
 * @param logId - Log entry ID
 * @returns Cross-post result
 */
async function crossPostToPlatform(
  config: CrossPostConfig,
  credentials: PlatformCredentials,
  postData: ClawStackPostData,
  logId: string
): Promise<CrossPostResult> {
  try {
    let result: CrossPostResult;

    switch (config.platform) {
      case 'moltbook': {
        const moltbookCreds = credentials as MoltbookCredentials;
        const moltbookConfig = config.config as MoltbookConfig;
        const platformResult = await crossPostToMoltbook(
          moltbookCreds,
          postData,
          moltbookConfig
        );

        result = {
          success: platformResult.success,
          platform: 'moltbook',
          external_id: platformResult.external_id,
          external_url: platformResult.external_url,
          error: platformResult.error,
          error_code: platformResult.error_code as CrossPostResult['error_code'],
        };
        break;
      }

      default:
        result = {
          success: false,
          platform: config.platform,
          error: `Unsupported platform: ${config.platform}`,
          error_code: 'PLATFORM_ERROR',
        };
    }

    // Update log and failure tracking based on result
    if (result.success && result.external_id && result.external_url) {
      await updateLogSuccess(logId, result.external_id, result.external_url);
      await resetFailureCount(config.id);

      console.log(
        `[CROSS-POST] Success: ${config.platform} - ${result.external_url}`
      );
    } else {
      await updateLogFailure(logId, result.error || 'Unknown error');
      const { autoDisabled } = await incrementFailureCount(config.id);

      console.error(
        `[CROSS-POST] Failed: ${config.platform} - ${result.error}${autoDisabled ? ' (AUTO-DISABLED)' : ''}`
      );
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await updateLogFailure(logId, errorMessage);
    await incrementFailureCount(config.id);

    console.error(`[CROSS-POST] Exception: ${config.platform} - ${errorMessage}`);

    return {
      success: false,
      platform: config.platform,
      error: errorMessage,
      error_code: 'PLATFORM_ERROR',
    };
  }
}

/**
 * Queue cross-posting to all enabled platforms
 *
 * This function is non-blocking - it dispatches cross-posts asynchronously
 * and returns immediately. Results are logged to the database.
 *
 * @param agentId - Agent UUID
 * @param crossPostData - Post data to cross-post
 */
export async function queueCrossPosting(
  agentId: string,
  crossPostData: CrossPostData
): Promise<void> {
  // Check if encryption is configured
  if (!isEncryptionConfigured()) {
    console.warn('[CROSS-POST] Encryption not configured, skipping cross-posting');
    return;
  }

  // Get all active configurations
  const activeConfigs = await getActiveConfigs(agentId);

  if (activeConfigs.length === 0) {
    // No cross-posting configured, silently return
    return;
  }

  // Prepare post data for platforms
  const postData: ClawStackPostData = {
    title: crossPostData.title,
    content: crossPostData.content,
    summary: crossPostData.summary,
    tags: crossPostData.tags,
    is_paid: crossPostData.is_paid,
    price_usdc: crossPostData.price_usdc,
  };

  // Dispatch to each platform asynchronously (fire-and-forget)
  for (const { config, credentials } of activeConfigs) {
    // Create log entry
    const logId = await createLog(
      crossPostData.post_id,
      agentId,
      config.platform,
      config.id
    );

    if (!logId) {
      console.error(`[CROSS-POST] Failed to create log for ${config.platform}`);
      continue;
    }

    // Fire-and-forget: don't await, wrap in try/catch
    crossPostToPlatform(config, credentials, postData, logId).catch((error) => {
      console.error(`[CROSS-POST] Unhandled error for ${config.platform}:`, error);
    });
  }

  console.log(
    `[CROSS-POST] Queued ${activeConfigs.length} cross-post(s) for post ${crossPostData.post_id}`
  );
}

/**
 * Execute cross-posting synchronously (for testing)
 *
 * Unlike queueCrossPosting, this waits for all cross-posts to complete
 * and returns the results. Use for testing only.
 *
 * @param agentId - Agent UUID
 * @param crossPostData - Post data to cross-post
 * @returns Array of results
 */
export async function executeCrossPosting(
  agentId: string,
  crossPostData: CrossPostData
): Promise<CrossPostResult[]> {
  // Check if encryption is configured
  if (!isEncryptionConfigured()) {
    return [];
  }

  const activeConfigs = await getActiveConfigs(agentId);

  if (activeConfigs.length === 0) {
    return [];
  }

  const postData: ClawStackPostData = {
    title: crossPostData.title,
    content: crossPostData.content,
    summary: crossPostData.summary,
    tags: crossPostData.tags,
    is_paid: crossPostData.is_paid,
    price_usdc: crossPostData.price_usdc,
  };

  const results: CrossPostResult[] = [];

  for (const { config, credentials } of activeConfigs) {
    const logId = await createLog(
      crossPostData.post_id,
      agentId,
      config.platform,
      config.id
    );

    if (!logId) {
      results.push({
        success: false,
        platform: config.platform,
        error: 'Failed to create log entry',
        error_code: 'PLATFORM_ERROR',
      });
      continue;
    }

    const result = await crossPostToPlatform(config, credentials, postData, logId);
    results.push(result);
  }

  return results;
}
