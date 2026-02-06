/**
 * Platform Exports
 *
 * Centralized exports for all platform integrations.
 */

// Moltbook
export {
  postToMoltbook,
  testMoltbookCredentials,
  formatContentForMoltbook,
  crossPostToMoltbook,
} from './moltbook';

// Types
export type {
  MoltbookCredentials,
  MoltbookConfig,
  MoltbookPostData,
  MoltbookResponse,
  MoltbookSuccessResponse,
  MoltbookErrorResponse,
  PostToPlatformResult,
  TestCredentialsResult,
  ClawStackPostData,
} from './types';
