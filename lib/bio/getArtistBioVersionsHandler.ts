import { NextResponse } from "next/server";
import { validateArtistEditRequest } from "@/lib/auth/validateArtistEditRequest";
import { getBioVersionsByArtistId } from "@/lib/bio/getBioVersionsByArtistId";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/artistBio/{id}/versions: the claimant or an admin lists the
 * artist's saved bios, newest first, with the pinned one marked.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status, versions }`; 400, 401, 403 or 500.
 */
export async function getArtistBioVersionsHandler(request: Request, id: string) {
  const headers = getCorsHeaders();
  try {
    const auth = await validateArtistEditRequest(request, id);
    if (auth instanceof NextResponse) return auth;
    const versions = await getBioVersionsByArtistId(auth.artistId);
    return NextResponse.json(
      { status: "ok", versions },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[artistBio/versions] Read failed", error);
    return NextResponse.json(
      { status: "error", error: "Failed to load bio versions" },
      { status: 500, headers },
    );
  }
}
