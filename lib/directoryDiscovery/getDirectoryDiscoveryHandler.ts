import { NextResponse } from "next/server";
import { ARTIST_ID_PATTERN } from "@/lib/artists/const";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getDirectoryDiscoveryStatus } from "@/lib/directoryDiscovery/getDirectoryDiscoveryStatus";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/artist/{id}/directory-discovery: only the account that
 * recently added the artist, or an admin, may observe the directory research.
 * Every answer is private and uncached.
 *
 * @param request - The request; a Privy token.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status, state, revision }`; 400, 401, 404 or 503.
 */
export async function getDirectoryDiscoveryHandler(request: Request, id: string) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  const fail = (error: string, status: number) =>
    NextResponse.json({ status: "error", error }, { status, headers });
  if (!ARTIST_ID_PATTERN.test(id)) return fail("Invalid artist", 400);
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) {
      auth.headers.set("Cache-Control", "private, no-store");
      return auth;
    }
    const status = await getDirectoryDiscoveryStatus(id, auth.userId);
    if (!status) return fail("Discovery is unavailable.", 404);
    return NextResponse.json({ status: "ok", ...status }, { headers });
  } catch {
    return fail("Discovery could not be checked.", 503);
  }
}
