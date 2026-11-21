import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthorizeRequest } from "@/lib/oauth/validateAuthorizeRequest";

/**
 * Handles GET /api/oauth/consent: checks the authorization request the
 * sign-in page received and says which agent is asking.
 *
 * @param request - The request, with the authorization request's query.
 * @returns 200 `{ status, agent, redirectHost }`; 400 or 500 `{ status: "error", error }`.
 */
export async function getConsentHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const url = new URL(request.url);
    const result = await validateAuthorizeRequest(Object.fromEntries(url.searchParams), url.origin);
    if (!result.ok)
      return NextResponse.json(
        { status: "error", error: "Invalid authorization request" },
        { status: 400, headers },
      );
    return NextResponse.json(
      { status: "ok", agent: result.client.name, redirectHost: new URL(result.redirectUri).host },
      { headers },
    );
  } catch (error) {
    console.error("[oauth] consent read error", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
