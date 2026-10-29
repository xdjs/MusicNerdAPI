import { NextResponse } from "next/server";
import { z } from "zod";
import { findActiveClaim } from "@/lib/artistViewer/findActiveClaim";
import { getArtistById } from "@/lib/artists/getArtistById";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const artistIdSchema = z.uuid({ error: "artistId must be a UUID" });

/**
 * Handles GET /api/artist/{id}/viewer: the signed-in caller's relation to the
 * artist, which MusicNerdWeb's artist page read from the session. Their own
 * active claim's status (the page's "your claim is pending") and whether they
 * added the artist (the page watches a new artist's directory for its adder).
 *
 * @param request - The request; a signed-in user's Privy token.
 * @param id - The artist id from the path.
 * @returns 200 with `{ status, claimStatus, addedByCaller }`; 400, 401, 404 or 500.
 */
export async function getArtistViewerHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const artistId = artistIdSchema.safeParse(id);
  if (!artistId.success)
    return NextResponse.json(
      { status: "error", error: artistId.error.issues[0].message },
      { status: 400, headers },
    );
  try {
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse) return auth;
    const [artist, claim] = await Promise.all([
      getArtistById(artistId.data),
      findActiveClaim(artistId.data),
    ]);
    if (!artist)
      return NextResponse.json(
        { status: "error", error: "Artist not found" },
        { status: 404, headers },
      );
    return NextResponse.json(
      {
        status: "ok",
        claimStatus: claim?.userId === auth.userId ? claim.status : null,
        addedByCaller: artist.addedBy === auth.userId,
      },
      { headers },
    );
  } catch (e) {
    console.error("[artist/viewer] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
