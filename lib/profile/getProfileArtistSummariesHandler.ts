import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistSummaries } from "@/lib/profile/getArtistSummaries";
import { validateArtistSummariesQuery } from "@/lib/profile/validateArtistSummariesQuery";

/**
 * GET /api/profile/artist-summaries: the About of up to six artists.
 *
 * @param request - The request: a Privy bearer token and repeated `id` query parameters.
 * @returns 200 `{ status: "ok", summaries }`, or 400, 401 or 500.
 */
export async function getProfileArtistSummariesHandler(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  const ids = validateArtistSummariesQuery(request);
  if (ids instanceof NextResponse) return ids;
  const headers = getCorsHeaders();
  try {
    return NextResponse.json(
      { status: "ok", summaries: await getArtistSummaries(ids) },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[API] artist summaries error", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
