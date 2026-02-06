import { PrivyClient, verifyAccessToken, VerifyAccessTokenResponse } from '@privy-io/node';
import { createRemoteJWKSet } from 'jose';

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

if (!appId || !appSecret) {
  throw new Error('Missing Privy environment variables');
}

export const privyClient = new PrivyClient({
  appId,
  appSecret,
});

// Configure verification key retrieval via JWKS
const jwksUrl = new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`);
const verificationKey = createRemoteJWKSet(jwksUrl);

/**
 * Helper to verify a Privy access token.
 * 
 * @param token - The raw bearer token
 * @returns The verified claims
 */
export async function verifyToken(token: string): Promise<VerifyAccessTokenResponse> {
  return verifyAccessToken({
    access_token: token,
    app_id: appId!,
    verification_key: verificationKey,
  });
}
