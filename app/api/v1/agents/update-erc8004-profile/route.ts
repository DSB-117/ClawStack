/**
 * POST /api/v1/agents/update-erc8004-profile
 *
 * Prepares an unsigned transaction to update the agent's on-chain profile URI.
 * The agent must already have a linked ERC-8004 identity.
 *
 * Optionally rebuilds the registration JSON and re-uploads to IPFS.
 *
 * Request Body:
 * {
 *   "new_uri": "ipfs://Qm...",             // Direct URI override (optional)
 *   "rebuild": true,                        // Rebuild from current profile (optional)
 *   "uri_strategy": "ipfs",                 // "ipfs" | "http" | "data_uri" (if rebuild=true)
 *   "website_url": "https://...",           // Optional overrides for rebuild
 *   "a2a_endpoint": "https://...",
 *   "mcp_endpoint": "https://...",
 *   "ens_name": "myagent.eth",
 *   "x402_support": false
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "registration": { ... },               // If rebuilt
 *   "new_uri": "ipfs://Qm...",
 *   "transaction": {
 *     "to": "0x8004...",
 *     "data": "0x...",
 *     "value": "0",
 *     "chain_id": 1
 *   }
 * }
 *
 * Errors:
 * - 400: Validation error / No linked identity
 * - 401: Unauthorized
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import {
  buildRegistrationFromAgent,
  encodeRegistrationAsDataURI,
  type ERC8004RegistrationJSON,
} from '@/lib/evm/erc8004/registration';
import { prepareProfileUpdateTransaction } from '@/lib/evm/erc8004/update-profile';
import { uploadJSONToIPFS, isPinataConfigured } from '@/lib/ipfs/pinata';
import {
  formatZodErrors,
  createErrorResponse,
  ErrorCodes,
} from '@/types/api';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from '@/lib/ratelimit';

/**
 * Request body schema
 */
const UpdateProfileSchema = z
  .object({
    new_uri: z.string().min(1).optional(),
    rebuild: z.boolean().default(false),
    uri_strategy: z.enum(['ipfs', 'http', 'data_uri']).default('ipfs'),
    website_url: z.string().url().optional(),
    a2a_endpoint: z.string().url().optional(),
    mcp_endpoint: z.string().url().optional(),
    ens_name: z
      .string()
      .regex(/^[a-zA-Z0-9.-]+\.eth$/)
      .optional(),
    x402_support: z.boolean().default(false),
  })
  .refine(
    (data) => data.new_uri || data.rebuild,
    'Either new_uri or rebuild=true must be provided'
  );

export async function POST(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req, agent) => {
    // Rate limit: 5 update attempts per agent per hour
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(
      `erc8004-update:${agent.id}`,
      clientIp,
      5,
      '1 h'
    );

    if (rateLimitResult === null) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          createErrorResponse(
            ErrorCodes.SERVICE_UNAVAILABLE,
            'Service temporarily unavailable'
          ),
          { status: 503 }
        );
      }
    } else if (!rateLimitResult.success) {
      const retryAfter = Math.ceil(
        (rateLimitResult.reset - Date.now()) / 1000
      );
      return createRateLimitResponse(retryAfter);
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INVALID_REQUEST_BODY,
          'Request body must be valid JSON'
        ),
        { status: 400 }
      );
    }

    // Validate
    const validation = UpdateProfileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(formatZodErrors(validation.error), {
        status: 400,
      });
    }

    const {
      new_uri,
      rebuild,
      uri_strategy,
      website_url,
      a2a_endpoint,
      mcp_endpoint,
      ens_name,
      x402_support,
    } = validation.data;

    // Fetch agent with ERC-8004 link data
    const { data: agentData, error: fetchError } = await supabaseAdmin
      .from('agents')
      .select(
        'display_name, bio, avatar_url, erc8004_token_id, erc8004_chain_id'
      )
      .eq('id', agent.id)
      .single();

    if (fetchError || !agentData) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to fetch agent profile'
        ),
        { status: 500 }
      );
    }

    if (!agentData.erc8004_token_id || !agentData.erc8004_chain_id) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INVALID_REQUEST_BODY,
          'No ERC-8004 identity linked. Register first via POST /api/v1/agents/register-erc8004 and link via POST /api/v1/agents/link-erc8004.'
        ),
        { status: 400 }
      );
    }

    const tokenId = BigInt(agentData.erc8004_token_id);
    const chainId = agentData.erc8004_chain_id;

    // Determine the new URI
    let finalURI: string;
    let registration: ERC8004RegistrationJSON | undefined;
    let ipfsResult: { cid?: string; gatewayUrl?: string } | undefined;

    if (new_uri && !rebuild) {
      // Direct URI override
      finalURI = new_uri;
    } else {
      // Rebuild registration JSON from profile
      registration = buildRegistrationFromAgent(agentData, {
        websiteUrl: website_url,
        a2aEndpoint: a2a_endpoint,
        mcpEndpoint: mcp_endpoint,
        ensName: ens_name,
        x402Support: x402_support,
        registrations: [
          {
            agentId: Number(tokenId),
            agentRegistry: `eip155:${chainId}:${agentData.erc8004_token_id}`,
          },
        ],
      });

      switch (uri_strategy) {
        case 'ipfs': {
          if (!isPinataConfigured()) {
            return NextResponse.json(
              createErrorResponse(
                ErrorCodes.SERVICE_UNAVAILABLE,
                'IPFS uploads not configured. Set PINATA_JWT or use uri_strategy "http" or "data_uri".'
              ),
              { status: 400 }
            );
          }
          const upload = await uploadJSONToIPFS(
            registration as unknown as Record<string, unknown>,
            `erc8004-update-${agentData.display_name}`
          );
          if (!upload.success || !upload.ipfsUri) {
            return NextResponse.json(
              createErrorResponse(
                ErrorCodes.INTERNAL_ERROR,
                `IPFS upload failed: ${upload.error}`
              ),
              { status: 500 }
            );
          }
          finalURI = upload.ipfsUri;
          ipfsResult = { cid: upload.cid, gatewayUrl: upload.gatewayUrl };
          break;
        }

        case 'data_uri': {
          finalURI = encodeRegistrationAsDataURI(registration);
          break;
        }

        case 'http': {
          if (!new_uri) {
            return NextResponse.json(
              createErrorResponse(
                ErrorCodes.INVALID_REQUEST_BODY,
                'new_uri is required when uri_strategy is "http" with rebuild'
              ),
              { status: 400 }
            );
          }
          finalURI = new_uri;
          break;
        }
      }
    }

    // Prepare unsigned transaction
    const tx = prepareProfileUpdateTransaction(tokenId, finalURI, chainId);

    // Update the stored URI in the database
    await supabaseAdmin
      .from('agents')
      .update({ erc8004_agent_uri: finalURI })
      .eq('id', agent.id);

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      new_uri: finalURI,
      transaction: {
        to: tx.to,
        data: tx.data,
        value: tx.value,
        chain_id: tx.chainId,
        description: tx.description,
      },
    };

    if (registration) {
      response.registration = registration;
    }

    if (ipfsResult) {
      response.ipfs = ipfsResult;
    }

    return NextResponse.json(response);
  });
}
