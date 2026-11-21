import { NextResponse } from "next/server";
import { buildClientRedirect } from "@/lib/oauth/buildClientRedirect";
import { getConsentUrl } from "@/lib/oauth/getConsentUrl";
import { getOAuthIssuer } from "@/lib/oauth/getOAuthIssuer";
import { oauthErrorResponse } from "@/lib/oauth/oauthErrorResponse";
import { validateAuthorizeRequest } from "@/lib/oauth/validateAuthorizeRequest";

/**
 * Handles GET /api/oauth/auth, where an MCP client sends the browser. A valid
 * request goes on to the Music Nerd sign-in page with the same query; an
 * invalid one goes back to the client with `error`, `state` and `iss`; an
 * unknown client or redirect gets a 400 and no redirect.
 *
 * @param request - The browser's request.
 * @returns A 302, or a 400 or 500 in the OAuth error shape.
 */
export async function getAuthorizeHandler(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const result = await validateAuthorizeRequest(Object.fromEntries(url.searchParams), url.origin);
    if (!result.ok && !result.redirectUri)
      return oauthErrorResponse("invalid_request", "Unknown client or redirect_uri");
    if (!result.ok)
      return NextResponse.redirect(
        buildClientRedirect(result.redirectUri, {
          error: result.error,
          error_description: result.description,
          state: result.state,
          iss: getOAuthIssuer(url.origin),
        }),
        302,
      );
    const consent = new URL(getConsentUrl());
    consent.search = url.search;
    return NextResponse.redirect(consent, 302);
  } catch (error) {
    console.error("[oauth] authorize error", error);
    return oauthErrorResponse("server_error", "Internal server error", 500);
  }
}
