import { getPrivyClient } from "@/lib/auth/getPrivyClient";

/**
 * Verifies a Privy access token (the one the browser's Privy SDK holds).
 * MusicNerdWeb's dev-only `privyid:` and identity-token shortcuts aren't
 * accepted here.
 *
 * @param token - The access token.
 * @returns The Privy user id, or null when the token is invalid or expired.
 */
export async function verifyPrivyAccessToken(token: string): Promise<string | null> {
  try {
    const claims = await getPrivyClient().verifyAuthToken(token);
    return claims.userId;
  } catch (e) {
    console.error("[verifyPrivyAccessToken] Token rejected:", (e as Error)?.message);
    return null;
  }
}
