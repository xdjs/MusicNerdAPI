import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artists, artistClaims } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight for the Deezer ID lookup.
 *
 * @returns Empty 200 with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Find an artist by their Deezer platform ID, with claim-gated bio.
 *
 * @param request - POST body with `{ deezerID: string }`.
 * @returns The artist row (bio nulled unless claimed) or an error.
 */
export async function POST(request: Request) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  try {
    const body = await request.json().catch(() => null);
    const deezerID = typeof body?.deezerID === "string" ? body.deezerID.trim() : null;
    if (!deezerID) {
      return NextResponse.json(
        { status: "error", error: "Missing or invalid required parameters: deezerID" },
        { status: 400, headers },
      );
    }
    const artist = await db.query.artists.findFirst({
      where: eq(artists.deezer, deezerID),
    });
    if (!artist) {
      return NextResponse.json(
        { status: "error", error: "Artist not found" },
        { status: 404, headers },
      );
    }
    // Claim-gate the bio: only show it if the artist has an approved claim
    const claim = await db.query.artistClaims.findFirst({
      where: eq(artistClaims.artistId, artist.id),
      columns: { id: true, status: true },
    });
    const hasClaim = claim?.status === "approved";
    return NextResponse.json(
      { result: { ...artist, bio: hasClaim ? artist.bio : null } },
      { status: 200, headers },
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
