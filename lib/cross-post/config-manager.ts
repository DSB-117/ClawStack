/**
 * Cross-Post Configuration Manager
 *
 * CRUD operations for cross_post_configs table.
 * Handles credential encryption and masking.
 */

import { supabaseAdmin } from '@/lib/db/supabase-server';
import { encryptCredentials, decryptCredentials, maskApiKey } from './encryption';
import type {
  Platform,
  CrossPostConfig,
  PlatformCredentials,
  PlatformConfig,
  MaskedConfig,
} from './types';
import type { MoltbookCredentials } from './platforms/types';
import type { Json } from '@/types/database';

/**
 * Maximum failures before auto-disable
 */
const MAX_FAILURES = 5;

/**
 * Create or update a cross-post configuration
 *
 * @param agentId - Agent UUID
 * @param platform - Target platform
 * @param credentials - Platform credentials (will be encrypted)
 * @param config - Platform-specific configuration
 * @param enabled - Whether cross-posting is enabled
 * @returns Created/updated config (without decrypted credentials)
 */
export async function createOrUpdateConfig(
  agentId: string,
  platform: Platform,
  credentials: PlatformCredentials,
  config: PlatformConfig = {},
  enabled: boolean = true
): Promise<{ success: boolean; config?: MaskedConfig; error?: string }> {
  try {
    // Encrypt credentials
    const encryptedCredentials = encryptCredentials(credentials);

    // Check if config exists
    const { data: existing } = await supabaseAdmin
      .from('cross_post_configs')
      .select('id')
      .eq('agent_id', agentId)
      .eq('platform', platform)
      .single();

    if (existing) {
      // Update existing config
      const { data, error } = await supabaseAdmin
        .from('cross_post_configs')
        .update({
          encrypted_credentials: encryptedCredentials,
          config: config as Json,
          enabled,
          active: true, // Re-enable on credential update
          consecutive_failures: 0, // Reset on credential update
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update cross-post config:', error);
        return { success: false, error: 'Failed to update configuration' };
      }

      return {
        success: true,
        config: maskConfig(data as CrossPostConfig, credentials),
      };
    }

    // Create new config
    const { data, error } = await supabaseAdmin
      .from('cross_post_configs')
      .insert({
        agent_id: agentId,
        platform,
        encrypted_credentials: encryptedCredentials,
        config: config as Json,
        enabled,
        active: true,
        consecutive_failures: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create cross-post config:', error);

      if (error.code === '23505') {
        // Unique constraint violation (race condition)
        return { success: false, error: 'Configuration already exists' };
      }

      return { success: false, error: 'Failed to create configuration' };
    }

    return {
      success: true,
      config: maskConfig(data as CrossPostConfig, credentials),
    };
  } catch (error) {
    console.error('Error in createOrUpdateConfig:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Encryption error',
    };
  }
}

/**
 * Get configurations for an agent
 *
 * @param agentId - Agent UUID
 * @param platform - Optional platform filter
 * @returns Array of masked configurations
 */
export async function getConfigs(
  agentId: string,
  platform?: Platform
): Promise<MaskedConfig[]> {
  let query = supabaseAdmin
    .from('cross_post_configs')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (platform) {
    query = query.eq('platform', platform);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get cross-post configs:', error);
    return [];
  }

  return (data as CrossPostConfig[]).map((config) => {
    try {
      const credentials = decryptCredentials<PlatformCredentials>(
        config.encrypted_credentials
      );
      return maskConfig(config, credentials);
    } catch {
      // If decryption fails, return config with unknown preview
      return {
        id: config.id,
        platform: config.platform,
        config: config.config as PlatformConfig,
        enabled: config.enabled,
        active: config.active,
        consecutive_failures: config.consecutive_failures,
        last_post_at: config.last_post_at,
        created_at: config.created_at,
        updated_at: config.updated_at,
        credentials_preview: '[decryption failed]',
      };
    }
  });
}

/**
 * Get a single configuration with decrypted credentials
 * Internal use only - never expose to API responses
 *
 * @param agentId - Agent UUID
 * @param platform - Target platform
 * @returns Config with decrypted credentials or null
 */
export async function getConfigWithCredentials(
  agentId: string,
  platform: Platform
): Promise<{
  config: CrossPostConfig;
  credentials: PlatformCredentials;
} | null> {
  const { data, error } = await supabaseAdmin
    .from('cross_post_configs')
    .select('*')
    .eq('agent_id', agentId)
    .eq('platform', platform)
    .single();

  if (error || !data) {
    return null;
  }

  const configData = data as CrossPostConfig;

  try {
    const credentials = decryptCredentials<PlatformCredentials>(
      configData.encrypted_credentials
    );
    return {
      config: configData,
      credentials,
    };
  } catch (err) {
    console.error('Failed to decrypt credentials:', err);
    return null;
  }
}

/**
 * Get all active configurations for an agent
 * Returns decrypted credentials for internal dispatcher use
 *
 * @param agentId - Agent UUID
 * @returns Array of configs with decrypted credentials
 */
export async function getActiveConfigs(
  agentId: string
): Promise<Array<{ config: CrossPostConfig; credentials: PlatformCredentials }>> {
  const { data, error } = await supabaseAdmin
    .from('cross_post_configs')
    .select('*')
    .eq('agent_id', agentId)
    .eq('enabled', true)
    .eq('active', true);

  if (error || !data) {
    return [];
  }

  const results: Array<{ config: CrossPostConfig; credentials: PlatformCredentials }> = [];

  for (const config of data as CrossPostConfig[]) {
    try {
      const credentials = decryptCredentials<PlatformCredentials>(
        config.encrypted_credentials
      );
      results.push({ config, credentials });
    } catch (error) {
      console.error(`Failed to decrypt credentials for config ${config.id}:`, error);
      // Skip this config if decryption fails
    }
  }

  return results;
}

/**
 * Delete a configuration
 *
 * @param agentId - Agent UUID
 * @param platform - Target platform
 * @returns Success status
 */
export async function deleteConfig(
  agentId: string,
  platform: Platform
): Promise<{ success: boolean; error?: string }> {
  const { error, count } = await supabaseAdmin
    .from('cross_post_configs')
    .delete()
    .eq('agent_id', agentId)
    .eq('platform', platform);

  if (error) {
    console.error('Failed to delete cross-post config:', error);
    return { success: false, error: 'Failed to delete configuration' };
  }

  if (count === 0) {
    return { success: false, error: 'Configuration not found' };
  }

  return { success: true };
}

/**
 * Increment failure count and potentially auto-disable
 *
 * @param configId - Config UUID
 * @returns Whether the config was auto-disabled
 */
export async function incrementFailureCount(
  configId: string
): Promise<{ autoDisabled: boolean }> {
  // Get current failure count
  const { data: config } = await supabaseAdmin
    .from('cross_post_configs')
    .select('consecutive_failures')
    .eq('id', configId)
    .single();

  const newCount = (config?.consecutive_failures ?? 0) + 1;
  const shouldDisable = newCount >= MAX_FAILURES;

  await supabaseAdmin
    .from('cross_post_configs')
    .update({
      consecutive_failures: newCount,
      active: !shouldDisable,
      updated_at: new Date().toISOString(),
    })
    .eq('id', configId);

  if (shouldDisable) {
    console.log(`Cross-post config ${configId} auto-disabled after ${MAX_FAILURES} failures`);
  }

  return { autoDisabled: shouldDisable };
}

/**
 * Reset failure count on successful post
 *
 * @param configId - Config UUID
 */
export async function resetFailureCount(configId: string): Promise<void> {
  await supabaseAdmin
    .from('cross_post_configs')
    .update({
      consecutive_failures: 0,
      active: true,
      last_post_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', configId);
}

/**
 * Create a masked version of config for API responses
 */
function maskConfig(
  config: CrossPostConfig,
  credentials: PlatformCredentials
): MaskedConfig {
  let credentialsPreview = '***';

  // Get preview based on platform
  if (config.platform === 'moltbook') {
    const moltbookCreds = credentials as MoltbookCredentials;
    credentialsPreview = maskApiKey(moltbookCreds.api_key);
  }

  return {
    id: config.id,
    platform: config.platform,
    config: config.config as PlatformConfig,
    enabled: config.enabled,
    active: config.active,
    consecutive_failures: config.consecutive_failures,
    last_post_at: config.last_post_at,
    created_at: config.created_at,
    updated_at: config.updated_at,
    credentials_preview: credentialsPreview,
  };
}
