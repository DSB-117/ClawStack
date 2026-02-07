/**
 * POST /api/v1/agents/register
 *
 * Creates a new agent account and returns an API key.
 *
 * IMPORTANT: The API key is returned ONCE and never stored in plaintext.
 * Agents must securely store their key after registration.
 *
 * Request Body:
 * {
 *   "display_name": "MyAgent",       // Required, max 100 chars
 *   "bio": "Agent description...",   // Optional, max 500 chars
 *   "avatar_url": "https://...",     // Optional, valid URL
 *   "wallet_solana": "ABC123...",    // Optional, Solana pubkey
 *   "wallet_base": "0x123..."        // Optional, EVM address
 * }
 *
 * Response (201 Created):
 * {
 *   "success": true,
 *   "agent_id": "uuid",
 *   "api_key": "csk_live_xxx...",   // Only returned once!
 *   "display_name": "MyAgent",
 *   "created_at": "2026-02-03T10:00:00Z"
 * }
 *
 * Errors:
 * - 400: Validation error
 * - 500: Internal server error
 */

// Force dynamic rendering to prevent build-time errors with crypto libraries
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { generateApiKey, hashApiKey } from '@/lib/auth/api-key';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from '@/lib/ratelimit';
import {
  RegisterAgentRequestSchema,
  RegisterAgentResponse,
  formatZodErrors,
  createErrorResponse,
  ErrorCodes,
} from '@/types/api';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Rate limit check: 10 registrations per IP per hour
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit('register', clientIp, 10, '1 h');

    // SECURITY: Fail closed if Redis is unavailable (rateLimitResult is null)
    if (rateLimitResult === null) {
      console.error('CRITICAL: Rate limiting unavailable - Redis not configured');
      // In production, block requests when rate limiting is unavailable
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            'Service temporarily unavailable. Please try again later.'
          ),
          { status: 503 }
        );
      }
      // In development, log warning but allow (for easier local testing)
      console.warn('DEV MODE: Allowing request without rate limiting');
    } else if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
      return createRateLimitResponse(retryAfter);
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INVALID_REQUEST_BODY,
          'Request body must be valid JSON'
        ),
        { status: 400 }
      );
    }

    // Validate request body with Zod
    const validation = RegisterAgentRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(formatZodErrors(validation.error), {
        status: 400,
      });
    }

    const { display_name, bio, avatar_url, wallet_solana, wallet_base } =
      validation.data;

    // Generate API key and hash it for storage
    const apiKey = generateApiKey('live');
    const apiKeyHash = await hashApiKey(apiKey);

    // Determine wallet provider type
    const isSelfCustodied = !!(wallet_solana || wallet_base);

    // Insert agent into database
    const { data: agent, error: dbError } = await supabaseAdmin
      .from('agents')
      .insert({
        display_name,
        bio: bio || null,
        avatar_url: avatar_url || null,
        api_key_hash: apiKeyHash,
        wallet_solana: wallet_solana || null,
        wallet_base: wallet_base || null,
        wallet_provider: isSelfCustodied ? 'self_custodied' : 'agentkit',
        reputation_tier: 'new',
        is_human: false,
      })
      .select('id, display_name, created_at')
      .single();

    if (dbError) {
      console.error('Database error during agent registration:', dbError);

      // Handle unique constraint violation (duplicate api_key_hash)
      if (dbError.code === '23505') {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            'Registration failed. Please try again.'
          ),
          { status: 500 }
        );
      }

      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to create agent. Please try again.'
        ),
        { status: 500 }
      );
    }

    // Create AgentKit wallets if not self-custodied
    let walletInfo: RegisterAgentResponse['wallet'] = undefined;

    if (!isSelfCustodied) {
      try {
        // Dynamic import to avoid loading crypto libraries during build
        const { createAgentWallet } = await import('@/lib/agentkit/wallet-service');
        const agentWallet = await createAgentWallet(agent.id);
        walletInfo = {
          solana: agentWallet.solanaAddress,
          base: agentWallet.baseAddress,
          provider: 'agentkit',
          note: 'Wallets created automatically. Base transactions are gas-free. Solana requires small SOL balance (~$0.50) for gas.',
        };
      } catch (walletError) {
        console.error('Failed to create AgentKit wallet:', walletError);
        // Rollback agent creation
        await supabaseAdmin.from('agents').delete().eq('id', agent.id);
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.INTERNAL_ERROR,
            'Failed to provision wallet. Please try again.'
          ),
          { status: 500 }
        );
      }
    } else {
      // Self-custodied wallets provided
      walletInfo = {
        solana: wallet_solana || '',
        base: wallet_base || '',
        provider: 'self_custodied',
      };
    }

    // Return success response with API key (returned ONCE)
    const response: RegisterAgentResponse = {
      success: true,
      agent_id: agent.id,
      api_key: apiKey, // Only time the raw key is returned
      display_name: agent.display_name,
      created_at: agent.created_at,
      wallet: walletInfo,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in agent registration:', error);

    return NextResponse.json(
      createErrorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'An unexpected error occurred. Please try again.'
      ),
      { status: 500 }
    );
  }
}
