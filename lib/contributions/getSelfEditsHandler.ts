import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getArtistSelfEdits } from "@/lib/contributions/getArtistSelfEdits";
import { validateSelfEditsQuery } from "@/lib/contributions/validateSelfEditsQuery";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * GET /api/selfEdits: the signed-in user's edits to their own artist profile,
 * ten per page. Signed-in only; never cached.
 *
 * @param request - The request; a Privy token, `page` optional.
 * @returns 200 with `{ status, entries, total, page, pageCount }`, 400 for a bad page, 401, or 500.
 */
export async function getSelfEditsHandler(request: Request) {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const query = validateSelfEditsQuery(request);
    if (query instanceof NextResponse) return query;
    const history = await getArtistSelfEdits(auth.userId, query.page);
    return NextResponse.json(
      { status: "ok", ...history },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[selfEdits] Unable to load history", error);
    return NextResponse.json(
      { status: "error", error: "Unable to load profile edits" },
      { status: 500, headers },
    );
  }
}
