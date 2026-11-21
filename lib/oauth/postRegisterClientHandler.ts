import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { insertOAuthClient } from "@/lib/oauth/insertOAuthClient";
import { oauthErrorResponse } from "@/lib/oauth/oauthErrorResponse";
import { validateClientRegistration } from "@/lib/oauth/validateClientRegistration";

/**
 * Handles POST /api/oauth/reg, dynamic client registration (RFC 7591). Every
 * client is public: no secret, PKCE instead.
 *
 * @param request - The request; `{ client_name?, redirect_uris }`.
 * @returns 201 with the registration; 400 or 500 in the OAuth error shape.
 */
export async function postRegisterClientHandler(request: Request): Promise<NextResponse> {
  try {
    const body = validateClientRegistration(await request.json().catch(() => null));
    if (body instanceof NextResponse) return body;
    const clientId = await insertOAuthClient(body.name, body.redirectUris);
    return NextResponse.json(
      {
        client_id: clientId,
        client_name: body.name,
        redirect_uris: body.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      { status: 201, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[oauth] register error", error);
    return oauthErrorResponse("server_error", "Internal server error", 500);
  }
}
