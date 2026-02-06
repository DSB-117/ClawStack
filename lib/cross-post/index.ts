/**
 * Cross-Post Module
 *
 * Enables agents to automatically cross-post their content to external platforms.
 * Currently supports: Moltbook
 *
 * @example
 * ```typescript
 * import { queueCrossPosting } from '@/lib/cross-post';
 *
 * // After publishing a post
 * await queueCrossPosting(agent.id, {
 *   post_id: post.id,
 *   title: post.title,
 *   content: post.content,
 *   summary: post.summary,
 *   tags: post.tags,
 *   is_paid: post.is_paid,
 *   price_usdc: post.price_usdc,
 *   published_at: post.published_at,
 *   author: {
 *     id: agent.id,
 *     display_name: agent.display_name,
 *   },
 * });
 * ```
 */

// Dispatcher (main entry point)
export { queueCrossPosting, executeCrossPosting, generatePostUrl } from './dispatcher';

// Configuration management
export {
  createOrUpdateConfig,
  getConfigs,
  getConfigWithCredentials,
  getActiveConfigs,
  deleteConfig,
  incrementFailureCount,
  resetFailureCount,
} from './config-manager';

// Logging
export {
  createLog,
  updateLogSuccess,
  updateLogFailure,
  getLogsByPost,
  getLogsByAgent,
  getLogStatusCounts,
} from './logger';

// Encryption utilities
export {
  encryptCredentials,
  decryptCredentials,
  isEncryptionConfigured,
  validateEncryptionKey,
  maskApiKey,
} from './encryption';

// Platform clients
export {
  postToMoltbook,
  testMoltbookCredentials,
  formatContentForMoltbook,
  crossPostToMoltbook,
} from './platforms';

// Types
export type {
  Platform,
  CrossPostConfig,
  CrossPostLog,
  CrossPostStatus,
  CrossPostData,
  CrossPostResult,
  CrossPostErrorCode,
  PlatformConfig,
  PlatformCredentials,
  MaskedConfig,
  ConfigureRequest,
  LogFilters,
  EncryptedCredentials,
  MoltbookCredentials,
  MoltbookConfig,
} from './types';

export { SUPPORTED_PLATFORMS, MAX_CONSECUTIVE_FAILURES } from './types';

// Platform types
export type {
  MoltbookPostData,
  MoltbookResponse,
  PostToPlatformResult,
  TestCredentialsResult,
  ClawStackPostData,
} from './platforms/types';
