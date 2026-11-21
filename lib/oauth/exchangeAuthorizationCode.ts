import type { NextResponse } from "next/server";
import { consumeOAuthToken } from "@/lib/oauth/consumeOAuthToken";
import { issueTokenPair } from "@/lib/oauth/issueTokenPair";
import { oauthErrorResponse } from "@/lib/oauth/oauthErrorResponse";
import type { TokenResponse } from "@/lib/oauth/types";
import { verifyPkce } from "@/lib/oauth/verifyPkce";

/**
 * The authorization code grant. The code is used up first, atomically, so a
 * code that fails any check below is spent too: it must belong to this
 * client, come with the same redirect URI, and the verifier must match its
 * S256 challenge.
 *
 * @param params - The token request's form fields.
 * @returns A new token pair, or a 400 OAuth error.
 */
export async function exchangeAuthorizationCode(
  params: URLSearchParams,
): Promise<TokenResponse | NextResponse> {
  const code = params.get("code");
  const verifier = params.get("code_verifier");
  const redirectUri = params.get("redirect_uri");
  if (!code || !verifier || !redirectUri)
    return oauthErrorResponse(
      "invalid_request",
      "code, code_verifier and redirect_uri are required",
    );

  const row = await consumeOAuthToken(code, "code");
  if (
    !row?.codeChallenge ||
    row.clientId !== params.get("client_id") ||
    row.redirectUri !== redirectUri ||
    !verifyPkce(verifier, row.codeChallenge)
  )
    return oauthErrorResponse("invalid_grant", "The code is invalid, expired or already used");

  return issueTokenPair(row.grantId);
}
