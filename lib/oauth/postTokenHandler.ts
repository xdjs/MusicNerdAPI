import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { exchangeAuthorizationCode } from "@/lib/oauth/exchangeAuthorizationCode";
import { oauthErrorResponse } from "@/lib/oauth/oauthErrorResponse";
import { refreshAccessToken } from "@/lib/oauth/refreshAccessToken";

/**
 * Handles POST /api/oauth/token (form-encoded): swaps an authorization code
 * or a refresh token for a new access token and refresh token.
 *
 * @param request - The request; `grant_type`, `client_id` and the grant's fields.
 * @returns 200 with the tokens, uncached; 400 or 500 in the OAuth error shape.
 */
export async function postTokenHandler(request: Request): Promise<NextResponse> {
  try {
    const params = new URLSearchParams(await request.text());
    if (!params.get("client_id"))
      return oauthErrorResponse("invalid_request", "client_id is required");
    const grantType = params.get("grant_type");
    const result =
      grantType === "authorization_code"
        ? await exchangeAuthorizationCode(params)
        : grantType === "refresh_token"
          ? await refreshAccessToken(params)
          : oauthErrorResponse(
              "unsupported_grant_type",
              "grant_type must be authorization_code or refresh_token",
            );
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result, {
      headers: { ...getCorsHeaders(), "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[oauth] token error", error);
    return oauthErrorResponse("server_error", "Internal server error", 500);
  }
}
