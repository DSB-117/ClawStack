/**
 * Moltbook Platform Client Tests
 */

import {
  postToMoltbook,
  testMoltbookCredentials,
  formatContentForMoltbook,
  crossPostToMoltbook,
} from '../moltbook';
import type { MoltbookCredentials, MoltbookPostData, ClawStackPostData } from '../types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

describe('Moltbook Platform Client', () => {
  const testCredentials: MoltbookCredentials = {
    api_key: 'test_moltbook_api_key',
  };

  const testPostData: MoltbookPostData = {
    title: 'Test Post',
    content: '# Hello World\n\nThis is a test post with **markdown**.',
    submolt: 'general',
  };

  const testClawStackPost: ClawStackPostData = {
    title: 'Test Post',
    content: '# Hello World\n\nThis is a test post with **markdown**.',
    summary: 'This is a test post...',
    tags: ['test', 'markdown'],
    is_paid: false,
    price_usdc: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('formatContentForMoltbook', () => {
    it('should format ClawStack post data for Moltbook', () => {
      const result = formatContentForMoltbook(testClawStackPost);

      expect(result).toEqual({
        title: 'Test Post',
        content: '# Hello World\n\nThis is a test post with **markdown**.',
        submolt: 'general',
      });
    });

    it('should use provided submolt config', () => {
      const result = formatContentForMoltbook(testClawStackPost, { submolt: 'tech' });

      expect(result.submolt).toBe('tech');
    });

    it('should default to "general" submolt', () => {
      const result = formatContentForMoltbook(testClawStackPost, {});

      expect(result.submolt).toBe('general');
    });

    it('should preserve full markdown content', () => {
      const complexPost: ClawStackPostData = {
        ...testClawStackPost,
        content: `# Title

## Subtitle

- Item 1
- Item 2

\`\`\`javascript
const x = 1;
\`\`\`

> Quote here

**Bold** and *italic* and ~~strikethrough~~`,
      };

      const result = formatContentForMoltbook(complexPost);

      expect(result.content).toBe(complexPost.content);
    });
  });

  describe('postToMoltbook', () => {
    it('should successfully post content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Post created!',
          post: { id: 'moltbook_123' },
        }),
      });

      const result = await postToMoltbook(testCredentials, testPostData);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('moltbook');
      expect(result.external_id).toBe('moltbook_123');
      expect(result.external_url).toBe(
        'https://www.moltbook.com/m/general/post/moltbook_123'
      );
    });

    it('should send correct request format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Post created!',
          post: { id: 'moltbook_123' },
        }),
      });

      await postToMoltbook(testCredentials, testPostData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.moltbook.com/api/v1/posts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test_moltbook_api_key',
          }),
          body: JSON.stringify(testPostData),
        })
      );
    });

    it('should handle 401 authentication error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: 'Invalid API key',
        }),
      });

      const result = await postToMoltbook(testCredentials, testPostData);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('AUTH_FAILED');
      expect(result.error).toContain('Invalid or expired API key');
    });

    it('should handle 400 bad request error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Invalid submolt',
        }),
      });

      const result = await postToMoltbook(testCredentials, testPostData);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('INVALID_CONTENT');
      expect(result.error).toBe('Invalid submolt');
    });

    it('should handle 429 rate limit error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          success: false,
          error: 'Rate limit exceeded',
        }),
      });

      const result = await postToMoltbook(testCredentials, testPostData);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('RATE_LIMITED');
    });

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: 'Internal server error',
        }),
      });

      const result = await postToMoltbook(testCredentials, testPostData);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('PLATFORM_ERROR');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await postToMoltbook(testCredentials, testPostData);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('NETWORK_ERROR');
      expect(result.error).toContain('Network error');
    });

    it('should handle timeout (AbortError)', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await postToMoltbook(testCredentials, testPostData);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('NETWORK_ERROR');
      expect(result.error).toContain('timed out');
    });
  });

  describe('testMoltbookCredentials', () => {
    it('should return success when /me endpoint returns 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: { id: '123' } }),
      });

      const result = await testMoltbookCredentials(testCredentials);

      expect(result.success).toBe(true);
      expect(result.message).toContain('verified');
    });

    it('should return failure for 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      const result = await testMoltbookCredentials(testCredentials);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('AUTH_FAILED');
    });

    it('should try alternative validation when /me returns 404', async () => {
      // First call to /me returns 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      // Second call to HEAD /posts returns 200 (auth passed)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await testMoltbookCredentials(testCredentials);

      expect(result.success).toBe(true);
      expect(result.message).toContain('accepted');
    });

    it('should include submolt in success message when configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: { id: '123' } }),
      });

      const result = await testMoltbookCredentials(testCredentials, {
        submolt: 'tech',
      });

      expect(result.message).toContain('tech');
    });

    it('should handle network errors during test', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await testMoltbookCredentials(testCredentials);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('NETWORK_ERROR');
    });
  });

  describe('crossPostToMoltbook', () => {
    it('should format and post in one call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Post created!',
          post: { id: 'moltbook_456' },
        }),
      });

      const result = await crossPostToMoltbook(
        testCredentials,
        testClawStackPost,
        { submolt: 'programming' }
      );

      expect(result.success).toBe(true);
      expect(result.external_url).toContain('programming');
    });
  });
});
