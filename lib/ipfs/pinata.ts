/**
 * IPFS Upload Service via Pinata
 *
 * Uploads JSON files to IPFS using the Pinata pinning API.
 * Used by the ERC-8004 registration flow to host agent metadata.
 *
 * @see https://docs.pinata.cloud/api-reference
 */

// ============================================
// Types
// ============================================

/**
 * Pinata pin response
 */
export interface PinataPinResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

/**
 * Result of an IPFS upload
 */
export interface IPFSUploadResult {
  success: boolean;
  cid?: string;
  ipfsUri?: string;
  gatewayUrl?: string;
  error?: string;
}

// ============================================
// Constants
// ============================================

const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs';

// ============================================
// Upload Functions
// ============================================

/**
 * Get the Pinata JWT from environment variables
 *
 * @returns JWT string or null if not configured
 */
function getPinataJWT(): string | null {
  return process.env.PINATA_JWT || null;
}

/**
 * Check if Pinata IPFS uploads are configured
 *
 * @returns True if PINATA_JWT is set
 */
export function isPinataConfigured(): boolean {
  return !!getPinataJWT();
}

/**
 * Upload a JSON object to IPFS via Pinata
 *
 * @param json - JSON object to upload
 * @param name - Descriptive name for the pin (shown in Pinata dashboard)
 * @returns Upload result with CID and URIs
 */
export async function uploadJSONToIPFS(
  json: Record<string, unknown>,
  name: string = 'erc-8004-agent-registration'
): Promise<IPFSUploadResult> {
  const jwt = getPinataJWT();
  if (!jwt) {
    return {
      success: false,
      error: 'PINATA_JWT environment variable not set. Get your JWT from https://app.pinata.cloud/developers/api-keys',
    };
  }

  try {
    const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        pinataContent: json,
        pinataMetadata: { name },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Pinata API error (${response.status}): ${errorText}`,
      };
    }

    const data = (await response.json()) as PinataPinResponse;

    if (!data.IpfsHash) {
      return {
        success: false,
        error: 'Pinata response missing IpfsHash',
      };
    }

    return {
      success: true,
      cid: data.IpfsHash,
      ipfsUri: `ipfs://${data.IpfsHash}`,
      gatewayUrl: `${PINATA_GATEWAY_URL}/${data.IpfsHash}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload to IPFS',
    };
  }
}

/**
 * Upload a file (as a Blob/Buffer) to IPFS via Pinata
 *
 * @param content - File content as a Buffer or string
 * @param filename - Filename for the upload
 * @param name - Descriptive name for the pin
 * @returns Upload result with CID and URIs
 */
export async function uploadFileToIPFS(
  content: Buffer | string,
  filename: string = 'agent-registration.json',
  name: string = 'erc-8004-agent-registration'
): Promise<IPFSUploadResult> {
  const jwt = getPinataJWT();
  if (!jwt) {
    return {
      success: false,
      error: 'PINATA_JWT environment variable not set',
    };
  }

  try {
    const stringContent = typeof content === 'string' ? content : content.toString('utf-8');
    const blob = new Blob([stringContent], { type: 'application/json' });

    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append(
      'pinataMetadata',
      JSON.stringify({ name })
    );

    const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Pinata API error (${response.status}): ${errorText}`,
      };
    }

    const data = (await response.json()) as PinataPinResponse;

    if (!data.IpfsHash) {
      return {
        success: false,
        error: 'Pinata response missing IpfsHash',
      };
    }

    return {
      success: true,
      cid: data.IpfsHash,
      ipfsUri: `ipfs://${data.IpfsHash}`,
      gatewayUrl: `${PINATA_GATEWAY_URL}/${data.IpfsHash}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload to IPFS',
    };
  }
}
