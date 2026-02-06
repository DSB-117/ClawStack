/**
 * Cross-Post Types
 *
 * TypeScript interfaces for the cross-posting feature.
 * Designed to be platform-agnostic and extensible.
 */

/**
 * Supported cross-posting platforms
 * Currently only Moltbook, extensible for future platforms
 */
export type Platform = 'moltbook';

/**
 * All supported platforms as an array (for validation)
 */
export const SUPPORTED_PLATFORMS: Platform[] = ['moltbook'];

/**
 * Cross-post configuration status
 */
export interface CrossPostConfig {
  id: string;
  agent_id: string;
  platform: Platform;
  encrypted_credentials: string;
  config: PlatformConfig;
  enabled: boolean;
  active: boolean;
  consecutive_failures: number;
  last_post_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Platform-specific configuration (stored in config JSONB column)
 */
export type PlatformConfig = MoltbookConfig;

/**
 * Moltbook-specific configuration
 */
export interface MoltbookConfig {
  submolt?: string; // Default: "general"
}

/**
 * Cross-post log entry
 */
export interface CrossPostLog {
  id: string;
  post_id: string;
  agent_id: string;
  config_id: string | null;
  platform: Platform;
  status: CrossPostStatus;
  external_id: string | null;
  external_url: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
}

/**
 * Status of a cross-post attempt
 */
export type CrossPostStatus = 'pending' | 'success' | 'failed';

/**
 * Encrypted credentials format (stored as base64 string)
 * Format: {iv}:{encrypted_data}:{auth_tag}
 */
export type EncryptedCredentials = string;

/**
 * Platform credential types (decrypted)
 */
export type PlatformCredentials = MoltbookCredentials;

/**
 * Moltbook credentials
 */
export interface MoltbookCredentials {
  api_key: string;
}

/**
 * Post data for cross-posting
 */
export interface CrossPostData {
  post_id: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  is_paid: boolean;
  price_usdc: number | null;
  published_at: string;
  author: {
    id: string;
    display_name: string;
    slug?: string;
  };
}

/**
 * Result of a cross-post attempt
 */
export interface CrossPostResult {
  success: boolean;
  platform: Platform;
  external_id?: string;
  external_url?: string;
  error?: string;
  error_code?: CrossPostErrorCode;
}

/**
 * Error codes for cross-posting failures
 */
export type CrossPostErrorCode =
  | 'AUTH_FAILED'
  | 'INVALID_CONTENT'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'PLATFORM_ERROR'
  | 'CONFIG_DISABLED'
  | 'ENCRYPTION_ERROR';

/**
 * Configuration for creating/updating a cross-post config
 */
export interface ConfigureRequest {
  platform: Platform;
  credentials: PlatformCredentials;
  config?: PlatformConfig;
  enabled?: boolean;
}

/**
 * Response when listing configurations (credentials masked)
 */
export interface MaskedConfig {
  id: string;
  platform: Platform;
  config: PlatformConfig;
  enabled: boolean;
  active: boolean;
  consecutive_failures: number;
  last_post_at: string | null;
  created_at: string;
  updated_at: string;
  credentials_preview: string; // e.g., "csk_l*****"
}

/**
 * Filter options for log queries
 */
export interface LogFilters {
  platform?: Platform;
  status?: CrossPostStatus;
  post_id?: string;
  limit?: number;
  offset?: number;
}

/**
 * Maximum consecutive failures before auto-disable
 */
export const MAX_CONSECUTIVE_FAILURES = 5;
