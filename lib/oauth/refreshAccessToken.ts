import type { NextResponse } from "next/server";
import { consumeOAuthToken } from "@/lib/oauth/consumeOAuthToken";
import { deleteGrantOfUsedRefreshToken } from "@/lib/oauth/deleteGrantOfUsedRefreshToken";
import { issueTokenPair } from "@/lib/oauth/issueTokenPair";
import { oauthErrorResponse } from "@/lib/oauth/oauthErrorResponse";
import { touchOAuthGrant } from "@/lib/oauth/touchOAuthGrant";
import type { TokenResponse } from "@/lib/oauth/types";

/**
 * The refresh token grant, with rotation: the refresh token is used up and a
 * new pair issued. Presenting one that was already used disconnects the agent.
 *
 * @param params - The token request's form fields.
 * @returns A new token pair, or a 400 OAuth error.
 */
export async function refreshAccessToken(
  params: URLSearchParams,
): Promise<TokenResponse | NextResponse> {
  const refreshToken = params.get("refresh_token");
  if (!refreshToken) return oauthErrorResponse("invalid_request", "refresh_token is required");

  const row = await consumeOAuthToken(refreshToken, "refresh");
  if (!row) {
    await deleteGrantOfUsedRefreshToken(refreshToken);
    return oauthErrorResponse("invalid_grant", "The refresh token is invalid or already used");
  }
  if (row.clientId !== params.get("client_id"))
    return oauthErrorResponse("invalid_grant", "The refresh token is invalid or already used");

  await touchOAuthGrant(row.grantId);
  return issueTokenPair(row.grantId);
}
