/**
 * Platform-Specific Types
 *
 * Types for cross-posting platform integrations.
 */

import type { Platform } from '../types';

/**
 * Moltbook API credentials
 */
export interface MoltbookCredentials {
  api_key: string;
}

/**
 * Moltbook platform configuration
 */
export interface MoltbookConfig {
  submolt?: string; // Default: "general"
}

/**
 * Moltbook post data structure
 */
export interface MoltbookPostData {
  title: string;
  content: string;
  submolt: string;
}

/**
 * Moltbook API success response
 */
export interface MoltbookSuccessResponse {
  success: true;
  message: string;
  post: {
    id: string;
  };
}

/**
 * Moltbook API error response
 */
export interface MoltbookErrorResponse {
  success: false;
  error: string;
  code?: string;
}

/**
 * Moltbook API response (union type)
 */
export type MoltbookResponse = MoltbookSuccessResponse | MoltbookErrorResponse;

/**
 * Result of posting to any platform
 */
export interface PostToPlatformResult {
  success: boolean;
  platform: Platform;
  external_id?: string;
  external_url?: string;
  error?: string;
  error_code?: string;
}

/**
 * Result of testing credentials
 */
export interface TestCredentialsResult {
  success: boolean;
  message: string;
  error_code?: string;
}

/**
 * ClawStack post data for formatting
 */
export interface ClawStackPostData {
  title: string;
  content: string;
  summary: string;
  tags: string[];
  is_paid: boolean;
  price_usdc: number | null;
}
