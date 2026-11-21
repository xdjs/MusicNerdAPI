import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { ACCESS_TOKEN_TTL_SECONDS, MCP_SCOPE } from "@/lib/oauth/const";
import { issueOAuthToken } from "@/lib/oauth/issueOAuthToken";
import type { TokenResponse } from "@/lib/oauth/types";

/**
 * Issues a new access token and refresh token under a grant. Clears the
 * grant's expired tokens and used codes first; used refresh tokens stay, so a
 * replay is still recognised.
 *
 * @param grantId - The grant.
 * @returns The token endpoint's success body.
 */
export async function issueTokenPair(grantId: string): Promise<TokenResponse> {
  await db.execute(sql`
    delete from oauth_tokens
    where grant_id = ${grantId} and kind <> 'refresh'
      and (expires_at <= now() or used_at is not null)
  `);
  const accessToken = await issueOAuthToken(grantId, "access");
  const refreshToken = await issueOAuthToken(grantId, "refresh");
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: MCP_SCOPE,
  };
}
