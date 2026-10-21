import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PHOTO_SOURCES } from "@/lib/artistImages/const";
import { getProviderPhoto } from "@/lib/artistImages/getProviderPhoto";
import { validatePhotoChoiceQuery } from "@/lib/artistImages/validatePhotoChoiceQuery";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { canEditArtist } from "@/lib/auth/canEditArtist";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/artist/photo-choice: the Deezer and Spotify photos the
 * artist can pick, with the current `customImage` the caller must echo back.
 *
 * @param request - The request; a claimant or admin Privy token, `artistId` in the query.
 * @returns 200 with `{ status, expectedCustomImage, options }`; 400, 401, 403, 404 or 503.
 */
export async function getPhotoChoiceHandler(request: Request): Promise<NextResponse> {
  const headers = { ...getCorsHeaders(), "Cache-Control": "no-store" };
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  const artistId = validatePhotoChoiceQuery(request);
  if (artistId instanceof NextResponse) return artistId;
  try {
    if (!(await canEditArtist(auth.userId, artistId)))
      return NextResponse.json(
        { status: "error", error: "Not authorized for this artist" },
        { status: 403, headers },
      );
    const artist = await db.query.artists.findFirst({ where: eq(artists.id, artistId) });
    if (!artist)
      return NextResponse.json(
        { status: "error", error: "Artist not found" },
        { status: 404, headers },
      );
    const options = await Promise.all(
      PHOTO_SOURCES.map(async source => ({
        source,
        providerId: artist[source]?.trim() || null,
        imageUrl: await getProviderPhoto(artist, source),
      })),
    );
    return NextResponse.json(
      { status: "ok", expectedCustomImage: artist.customImage, options },
      { status: 200, headers },
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Could not load photo choices" },
      { status: 503, headers },
    );
  }
}
