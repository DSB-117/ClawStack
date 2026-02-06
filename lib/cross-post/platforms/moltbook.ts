/**
 * Moltbook Platform Client
 *
 * Handles posting content to Moltbook via their API.
 * API Documentation: https://www.moltbook.com/developers
 */

import type {
  MoltbookCredentials,
  MoltbookConfig,
  MoltbookPostData,
  MoltbookResponse,
  PostToPlatformResult,
  TestCredentialsResult,
  ClawStackPostData,
} from './types';

/**
 * Moltbook API base URL
 */
const MOLTBOOK_API_URL = 'https://www.moltbook.com/api/v1';

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Default submolt when none specified
 */
const DEFAULT_SUBMOLT = 'general';

/**
 * Format ClawStack post data for Moltbook
 *
 * @param postData - ClawStack post data
 * @param config - Moltbook configuration
 * @returns Formatted Moltbook post data
 */
export function formatContentForMoltbook(
  postData: ClawStackPostData,
  config?: MoltbookConfig
): MoltbookPostData {
  // Use full markdown content unchanged
  // Moltbook supports full markdown with no character limits
  return {
    title: postData.title,
    content: postData.content,
    submolt: config?.submolt || DEFAULT_SUBMOLT,
  };
}

/**
 * Post content to Moltbook
 *
 * @param credentials - Moltbook API credentials
 * @param postData - Formatted post data
 * @returns Post result with external ID and URL
 */
export async function postToMoltbook(
  credentials: MoltbookCredentials,
  postData: MoltbookPostData
): Promise<PostToPlatformResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${MOLTBOOK_API_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.api_key}`,
        'User-Agent': 'ClawStack/1.0',
      },
      body: JSON.stringify(postData),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = (await response.json()) as MoltbookResponse;

    if (response.ok && data.success) {
      // Generate the external URL
      const externalUrl = `https://www.moltbook.com/m/${postData.submolt}/post/${data.post.id}`;

      return {
        success: true,
        platform: 'moltbook',
        external_id: data.post.id,
        external_url: externalUrl,
      };
    }

    // Handle specific error codes
    if (response.status === 401) {
      return {
        success: false,
        platform: 'moltbook',
        error: 'Invalid or expired API key',
        error_code: 'AUTH_FAILED',
      };
    }

    if (response.status === 400) {
      const errorResponse = data as { success: false; error: string };
      return {
        success: false,
        platform: 'moltbook',
        error: errorResponse.error || 'Invalid request',
        error_code: 'INVALID_CONTENT',
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        platform: 'moltbook',
        error: 'Rate limit exceeded. Try again later.',
        error_code: 'RATE_LIMITED',
      };
    }

    // Generic server error
    const errorResponse = data as { success: false; error?: string };
    return {
      success: false,
      platform: 'moltbook',
      error: errorResponse.error || `Server error (${response.status})`,
      error_code: 'PLATFORM_ERROR',
    };
  } catch (error) {
    // Handle network errors and timeouts
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          platform: 'moltbook',
          error: 'Request timed out after 30 seconds',
          error_code: 'NETWORK_ERROR',
        };
      }

      return {
        success: false,
        platform: 'moltbook',
        error: `Network error: ${error.message}`,
        error_code: 'NETWORK_ERROR',
      };
    }

    return {
      success: false,
      platform: 'moltbook',
      error: 'Unknown error occurred',
      error_code: 'PLATFORM_ERROR',
    };
  }
}

/**
 * Test Moltbook credentials
 *
 * Since Moltbook doesn't have a /verify endpoint,
 * we make a minimal test by attempting a request that would
 * fail validation but succeed auth check.
 *
 * @param credentials - Moltbook API credentials
 * @param config - Optional Moltbook configuration
 * @returns Test result with success/failure message
 */
export async function testMoltbookCredentials(
  credentials: MoltbookCredentials,
  config?: MoltbookConfig
): Promise<TestCredentialsResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Attempt to check if there's a user/me endpoint
    // If not, we'll try to post with minimal content and catch validation errors
    const response = await fetch(`${MOLTBOOK_API_URL}/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
        'User-Agent': 'ClawStack/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // If the endpoint exists and returns 200, credentials are valid
    if (response.ok) {
      return {
        success: true,
        message: `Credentials verified. Connected to Moltbook.${config?.submolt ? ` Submolt: ${config.submolt}` : ''}`,
      };
    }

    // 401 = invalid credentials
    if (response.status === 401) {
      return {
        success: false,
        message: 'Invalid API key. Please check your Moltbook API key.',
        error_code: 'AUTH_FAILED',
      };
    }

    // 404 = endpoint doesn't exist, try alternative validation
    if (response.status === 404) {
      // Try an alternative approach - check headers or try posts endpoint with HEAD
      const headResponse = await fetch(`${MOLTBOOK_API_URL}/posts`, {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${credentials.api_key}`,
          'User-Agent': 'ClawStack/1.0',
        },
      });

      if (headResponse.status === 401) {
        return {
          success: false,
          message: 'Invalid API key. Please check your Moltbook API key.',
          error_code: 'AUTH_FAILED',
        };
      }

      // If we get here, assume credentials work (we'll find out on first actual post)
      return {
        success: true,
        message: `API key format accepted.${config?.submolt ? ` Submolt: ${config.submolt}` : ''} Full verification will occur on first post.`,
      };
    }

    return {
      success: false,
      message: `Unexpected response from Moltbook (${response.status})`,
      error_code: 'PLATFORM_ERROR',
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Request timed out. Moltbook may be unavailable.',
          error_code: 'NETWORK_ERROR',
        };
      }

      return {
        success: false,
        message: `Network error: ${error.message}`,
        error_code: 'NETWORK_ERROR',
      };
    }

    return {
      success: false,
      message: 'Unknown error occurred while testing credentials',
      error_code: 'PLATFORM_ERROR',
    };
  }
}

/**
 * Create a full cross-post to Moltbook
 *
 * Convenience function that formats and posts in one call.
 *
 * @param credentials - Moltbook API credentials
 * @param postData - ClawStack post data
 * @param config - Moltbook configuration
 * @returns Post result
 */
export async function crossPostToMoltbook(
  credentials: MoltbookCredentials,
  postData: ClawStackPostData,
  config?: MoltbookConfig
): Promise<PostToPlatformResult> {
  const formattedPost = formatContentForMoltbook(postData, config);
  return postToMoltbook(credentials, formattedPost);
}
