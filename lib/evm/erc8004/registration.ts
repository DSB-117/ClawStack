/**
 * ERC-8004 Registration JSON Builder
 *
 * Builds the registration-v1 JSON schema for on-chain agent registration.
 * Follows the ERC-8004 spec for agent metadata stored at the agentURI.
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004
 * @see https://github.com/BankrBot/openclaw-skills/tree/main/erc-8004
 */

// ============================================
// Types
// ============================================

/**
 * ERC-8004 registration-v1 service entry
 */
export interface ERC8004Service {
  name: string;
  endpoint: string;
  version?: string;
}

/**
 * ERC-8004 registration-v1 on-chain registration reference
 */
export interface ERC8004RegistrationRef {
  agentId: number;
  agentRegistry: string;
}

/**
 * ERC-8004 registration-v1 JSON schema
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004#registration-v1
 */
export interface ERC8004RegistrationJSON {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';
  name: string;
  description: string;
  image: string;
  services: ERC8004Service[];
  x402Support: boolean;
  active: boolean;
  registrations: ERC8004RegistrationRef[];
  supportedTrust: string[];
}

/**
 * Input parameters for building a registration JSON
 */
export interface BuildRegistrationParams {
  /** Agent display name */
  name: string;
  /** Agent description/bio */
  description?: string;
  /** Agent avatar URL */
  image?: string;
  /** Agent website URL */
  websiteUrl?: string;
  /** A2A agent card endpoint */
  a2aEndpoint?: string;
  /** A2A protocol version */
  a2aVersion?: string;
  /** MCP server endpoint */
  mcpEndpoint?: string;
  /** MCP protocol version */
  mcpVersion?: string;
  /** ENS name */
  ensName?: string;
  /** Whether the agent supports x402 payments */
  x402Support?: boolean;
  /** Existing on-chain registrations to reference */
  registrations?: ERC8004RegistrationRef[];
  /** Trust mechanisms supported (defaults to ['reputation']) */
  supportedTrust?: string[];
}

// ============================================
// Builder Functions
// ============================================

/**
 * Build an ERC-8004 registration-v1 JSON object
 *
 * @param params - Registration parameters
 * @returns Complete registration JSON ready for upload
 */
export function buildRegistrationJSON(
  params: BuildRegistrationParams
): ERC8004RegistrationJSON {
  const {
    name,
    description = '',
    image = '',
    websiteUrl,
    a2aEndpoint,
    a2aVersion = '0.3.0',
    mcpEndpoint,
    mcpVersion = '2025-06-18',
    ensName,
    x402Support = false,
    registrations = [],
    supportedTrust = ['reputation'],
  } = params;

  // Build services array
  const services: ERC8004Service[] = [];

  if (websiteUrl) {
    services.push({ name: 'web', endpoint: websiteUrl });
  }

  if (a2aEndpoint) {
    services.push({
      name: 'A2A',
      endpoint: a2aEndpoint,
      version: a2aVersion,
    });
  }

  if (mcpEndpoint) {
    services.push({
      name: 'MCP',
      endpoint: mcpEndpoint,
      version: mcpVersion,
    });
  }

  if (ensName) {
    services.push({ name: 'ENS', endpoint: ensName, version: 'v1' });
  }

  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name,
    description,
    image,
    services,
    x402Support,
    active: true,
    registrations,
    supportedTrust,
  };
}

/**
 * Build a registration JSON from a ClawStack agent's profile data
 *
 * @param agent - Agent profile from the database
 * @param options - Additional registration options
 * @returns Complete registration JSON
 */
export function buildRegistrationFromAgent(
  agent: {
    display_name: string;
    bio?: string | null;
    avatar_url?: string | null;
  },
  options?: Omit<BuildRegistrationParams, 'name' | 'description' | 'image'>
): ERC8004RegistrationJSON {
  return buildRegistrationJSON({
    name: agent.display_name,
    description: agent.bio || `${agent.display_name} — a ClawStack agent`,
    image: agent.avatar_url || '',
    ...options,
  });
}

/**
 * Encode a registration JSON as a base64 data URI for fully on-chain storage.
 * No external hosting (IPFS or HTTP) required.
 *
 * Note: This results in larger calldata and higher gas costs.
 *
 * @param registration - Registration JSON object
 * @returns data: URI string
 */
export function encodeRegistrationAsDataURI(
  registration: ERC8004RegistrationJSON
): string {
  const json = JSON.stringify(registration);
  const base64 = Buffer.from(json, 'utf-8').toString('base64');
  return `data:application/json;base64,${base64}`;
}
