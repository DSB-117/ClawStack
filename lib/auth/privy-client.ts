import { PrivyClient, verifyAccessToken, VerifyAccessTokenResponse } from '@privy-io/node';
import { createRemoteJWKSet, JWTVerifyGetKey } from 'jose';

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

let privyClientInstance: PrivyClient | null = null;
let verificationKeyInstance: JWTVerifyGetKey | null = null;

export const privyClient = new Proxy({} as PrivyClient, {
  get(_target, prop) {
    if (!privyClientInstance) {
      if (!appId || !appSecret) {
        throw new Error('Missing Privy environment variables');
      }
      privyClientInstance = new PrivyClient({ appId, appSecret });
    }
    return Reflect.get(privyClientInstance, prop);
  }
});

/**
 * Helper to verify a Privy access token.
 * 
 * @param token - The raw bearer token
 * @returns The verified claims
 */
export async function verifyToken(token: string): Promise<VerifyAccessTokenResponse> {
  if (!appId || !appSecret) {
    throw new Error('Missing Privy environment variables');
  }

  if (!verificationKeyInstance) {
    const jwksUrl = new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`);
    verificationKeyInstance = createRemoteJWKSet(jwksUrl);
  }

  return verifyAccessToken({
    access_token: token,
    app_id: appId,
    verification_key: verificationKeyInstance,
  });
}
