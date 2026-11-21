import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { authenticateConsentUser } from "@/lib/oauth/authenticateConsentUser";
import { buildClientRedirect } from "@/lib/oauth/buildClientRedirect";
import { createOAuthGrant } from "@/lib/oauth/createOAuthGrant";
import { getOAuthIssuer } from "@/lib/oauth/getOAuthIssuer";
import { issueOAuthToken } from "@/lib/oauth/issueOAuthToken";
import { validateAuthorizeRequest } from "@/lib/oauth/validateAuthorizeRequest";

/**
 * Handles POST /api/oauth/consent: the signed-in member's decision on an
 * authorization request, checked again in full. Approving connects the agent
 * (a grant) and issues a single-use 60-second code; denying returns
 * `access_denied`.
 *
 * @param request - The request; a Privy token and the authorization request plus `decision`.
 * @returns 200 `{ status, redirectUrl }`; 400, 401 or 500 `{ status: "error", error }`.
 */
export async function postConsentHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateConsentUser(request);
    if (auth instanceof NextResponse) return auth;
    const body: unknown = await request.json().catch(() => null);
    const params = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const origin = new URL(request.url).origin;
    const result = await validateAuthorizeRequest(params, origin);
    if (!result.ok || (params.decision !== "approve" && params.decision !== "deny"))
      return NextResponse.json(
        { status: "error", error: "Invalid authorization request" },
        { status: 400, headers },
      );

    const iss = getOAuthIssuer(origin);
    if (params.decision === "deny")
      return NextResponse.json(
        {
          status: "ok",
          redirectUrl: buildClientRedirect(result.redirectUri, {
            error: "access_denied",
            state: result.state,
            iss,
          }),
        },
        { headers },
      );

    const grantId = await createOAuthGrant(result.client.id, auth.userId);
    const code = await issueOAuthToken(grantId, "code", {
      codeChallenge: result.codeChallenge,
      redirectUri: result.redirectUri,
    });
    return NextResponse.json(
      {
        status: "ok",
        redirectUrl: buildClientRedirect(result.redirectUri, { code, state: result.state, iss }),
      },
      { headers },
    );
  } catch (error) {
    console.error("[oauth] consent error", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
