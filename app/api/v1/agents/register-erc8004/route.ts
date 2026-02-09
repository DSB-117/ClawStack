/**
 * POST /api/v1/agents/register-erc8004
 *
 * Prepares an ERC-8004 on-chain registration for the authenticated agent.
 * Builds the registration JSON, optionally uploads to IPFS, and returns
 * an unsigned transaction for the agent to sign and submit.
 *
 * Request Body:
 * {
 *   "chain_id": 1,                          // 1 (mainnet) or 11155111 (sepolia)
 *   "uri_strategy": "ipfs",                 // "ipfs" | "http" | "data_uri"
 *   "registration_url": "https://...",      // Only for uri_strategy="http"
 *   "website_url": "https://...",           // Optional
 *   "a2a_endpoint": "https://...",          // Optional A2A agent card URL
 *   "mcp_endpoint": "https://...",          // Optional MCP server URL
 *   "ens_name": "myagent.eth",             // Optional ENS name
 *   "x402_support": false                   // Optional x402 payment support
 * }
 *
 * Response (200 OK):
 * {
 *   "success": true,
 *   "registration": { ... },               // The registration JSON
 *   "agent_uri": "ipfs://Qm...",           // The URI to be registered
 *   "transaction": {
 *     "to": "0x8004...",
 *     "data": "0x...",
 *     "value": "0",
 *     "chain_id": 1,
 *     "estimated_gas": "150000"
 *   },
 *   "ipfs": {                              // Only if uri_strategy="ipfs"
 *     "cid": "Qm...",
 *     "gateway_url": "https://gateway.pinata.cloud/ipfs/Qm..."
 *   }
 * }
 *
 * Errors:
 * - 400: Validation error / Chain not supported / IPFS not configured
 * - 401: Unauthorized (missing/invalid API key)
 * - 500: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { isERC8004SupportedChain, isERC8004Deployed } from '@/lib/evm/erc8004';
import {
  buildRegistrationFromAgent,
  encodeRegistrationAsDataURI,
  type ERC8004RegistrationJSON,
} from '@/lib/evm/erc8004/registration';
import { prepareRegistrationTransaction } from '@/lib/evm/erc8004/register';
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
const RegisterERC8004Schema = z.object({
  chain_id: z
    .number()
    .int()
    .refine(
      (val) => isERC8004SupportedChain(val),
      'chain_id must be 1 (Ethereum) or 11155111 (Sepolia)'
    ),
  uri_strategy: z.enum(['ipfs', 'http', 'data_uri']).default('ipfs'),
  registration_url: z
    .string()
    .url('registration_url must be a valid URL')
    .optional(),
  website_url: z
    .string()
    .url('website_url must be a valid URL')
    .optional(),
  a2a_endpoint: z
    .string()
    .url('a2a_endpoint must be a valid URL')
    .optional(),
  mcp_endpoint: z
    .string()
    .url('mcp_endpoint must be a valid URL')
    .optional(),
  ens_name: z
    .string()
    .regex(/^[a-zA-Z0-9.-]+\.eth$/, 'ens_name must be a valid ENS name')
    .optional(),
  x402_support: z.boolean().default(false),
});

export async function POST(request: NextRequest): Promise<Response> {
  return withAuth(request, async (req, agent) => {
    // Rate limit: 3 registration attempts per agent per hour
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(
      `erc8004-register:${agent.id}`,
      clientIp,
      3,
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

    // Validate request body
    const validation = RegisterERC8004Schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(formatZodErrors(validation.error), {
        status: 400,
      });
    }

    const {
      chain_id,
      uri_strategy,
      registration_url,
      website_url,
      a2a_endpoint,
      mcp_endpoint,
      ens_name,
      x402_support,
    } = validation.data;

    // Verify chain has deployed registries
    if (!isERC8004Deployed(chain_id)) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INVALID_REQUEST_BODY,
          `ERC-8004 registries are not yet deployed on chain ${chain_id}`
        ),
        { status: 400 }
      );
    }

    // For HTTP strategy, registration_url is required
    if (uri_strategy === 'http' && !registration_url) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INVALID_REQUEST_BODY,
          'registration_url is required when uri_strategy is "http"'
        ),
        { status: 400 }
      );
    }

    // For IPFS strategy, Pinata must be configured
    if (uri_strategy === 'ipfs' && !isPinataConfigured()) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.SERVICE_UNAVAILABLE,
          'IPFS uploads are not configured. Set PINATA_JWT or use uri_strategy "http" or "data_uri".'
        ),
        { status: 400 }
      );
    }

    // Fetch agent profile from database
    const { data: agentProfile, error: fetchError } = await supabaseAdmin
      .from('agents')
      .select('display_name, bio, avatar_url')
      .eq('id', agent.id)
      .single();

    if (fetchError || !agentProfile) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          'Failed to fetch agent profile'
        ),
        { status: 500 }
      );
    }

    // Build registration JSON
    const registration: ERC8004RegistrationJSON = buildRegistrationFromAgent(
      agentProfile,
      {
        websiteUrl: website_url,
        a2aEndpoint: a2a_endpoint,
        mcpEndpoint: mcp_endpoint,
        ensName: ens_name,
        x402Support: x402_support,
      }
    );

    // Determine agent URI based on strategy
    let agentURI: string;
    let ipfsResult: { cid?: string; gatewayUrl?: string } | undefined;

    switch (uri_strategy) {
      case 'ipfs': {
        const upload = await uploadJSONToIPFS(
          registration as unknown as Record<string, unknown>,
          `erc8004-${agentProfile.display_name}`
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
        agentURI = upload.ipfsUri;
        ipfsResult = { cid: upload.cid, gatewayUrl: upload.gatewayUrl };
        break;
      }

      case 'http': {
        agentURI = registration_url!;
        break;
      }

      case 'data_uri': {
        agentURI = encodeRegistrationAsDataURI(registration);
        break;
      }
    }

    // Prepare unsigned transaction
    const tx = prepareRegistrationTransaction(agentURI, chain_id);

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      registration,
      agent_uri: agentURI,
      transaction: {
        to: tx.to,
        data: tx.data,
        value: tx.value,
        chain_id: tx.chainId,
        estimated_gas: tx.estimatedGas,
        description: tx.description,
      },
    };

    if (ipfsResult) {
      response.ipfs = ipfsResult;
    }

    if (uri_strategy === 'data_uri') {
      response.note =
        'Data URI registration stores everything on-chain. This costs more gas but requires no external hosting.';
    }

    return NextResponse.json(response);
  });
}
