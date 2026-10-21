import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Authenticates a profile-page read and requires `X-Profile-Account` to be the
 * caller's id, so a page left open after switching accounts never shows the
 * new account's data under the old one.
 *
 * @param request - The request, with a Privy bearer token and `X-Profile-Account`.
 * @returns `{ userId }`, or a 401 or 409 response.
 */
export async function authenticateProfileRequest(
  request: Request,
): Promise<{ userId: string } | NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  if (request.headers.get("X-Profile-Account") !== auth.userId)
    return NextResponse.json(
      { status: "error", error: "Account changed. Refresh and try again." },
      { status: 409, headers: getCorsHeaders() },
    );
  return auth;
}
