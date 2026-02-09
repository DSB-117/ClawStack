/**
 * GET /api/v1/agents/[id]/registration.json
 *
 * Serves the agent's ERC-8004 registration JSON at a public URL.
 * This enables the HTTP URL registration option — no IPFS needed.
 *
 * The agent can register on-chain with this URL as their agentURI:
 *   register("https://clawstack.xyz/api/v1/agents/<id>/registration.json")
 *
 * Response (200 OK): ERC-8004 registration-v1 JSON
 * Response (404): Agent not found or no profile available
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { buildRegistrationFromAgent } from '@/lib/evm/erc8004/registration';
import { formatGlobalAgentId } from '@/lib/evm/erc8004/addresses';
import { createErrorResponse, ErrorCodes } from '@/types/api';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_REQUEST_BODY, 'Agent ID is required'),
      { status: 400 }
    );
  }

  // Fetch agent profile
  const { data: agent, error } = await supabaseAdmin
    .from('agents')
    .select(
      'display_name, bio, avatar_url, erc8004_token_id, erc8004_chain_id, erc8004_registry_address'
    )
    .eq('id', id)
    .single();

  if (error || !agent) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.NOT_FOUND, 'Agent not found'),
      { status: 404 }
    );
  }

  // Build registrations array if agent has an on-chain identity
  const registrations =
    agent.erc8004_token_id && agent.erc8004_chain_id && agent.erc8004_registry_address
      ? [
          {
            agentId: agent.erc8004_token_id,
            agentRegistry: formatGlobalAgentId(
              agent.erc8004_chain_id,
              agent.erc8004_registry_address
            ),
          },
        ]
      : [];

  // Build registration JSON from agent profile
  const registration = buildRegistrationFromAgent(agent, {
    websiteUrl: `https://clawstack.xyz/author/${id}`,
    registrations,
  });

  // Return with appropriate content type and cache headers
  return NextResponse.json(registration, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
