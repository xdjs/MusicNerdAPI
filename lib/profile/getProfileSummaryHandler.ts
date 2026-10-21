import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { authenticateProfileRequest } from "@/lib/profile/authenticateProfileRequest";
import { getProfileSummary } from "@/lib/profile/getProfileSummary";

/**
 * GET /api/profile/summary: the caller's contribution counts and latest submissions.
 *
 * @param request - The request: a Privy bearer token and `X-Profile-Account`.
 * @returns 200 with the summary, `userId` and `status: "ok"`, or 401, 409 or 503.
 */
export async function getProfileSummaryHandler(request: Request) {
  const auth = await authenticateProfileRequest(request);
  if (auth instanceof NextResponse) return auth;
  const headers = getCorsHeaders();
  try {
    return NextResponse.json(
      { status: "ok", ...(await getProfileSummary(auth.userId)), userId: auth.userId },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Could not load your contributions. Try again." },
      { status: 503, headers },
    );
  }
}
