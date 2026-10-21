import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { listRecentEdited } from "@/lib/contributions/listRecentEdited";
import { validateRecentEditedQuery } from "@/lib/contributions/validateRecentEditedQuery";
import { getArtistImages } from "@/lib/musicPlatform/getArtistImages";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * GET /api/recentEdited: the last three artists a user's approved submissions
 * touched, each with an image. `userId` names any user (the leaderboard);
 * without it the Privy token's user. With neither, or when the read fails,
 * the list is empty with a 200, as on MusicNerdWeb, which returned the bare
 * array; here it is `entries`.
 *
 * @param request - The request; `userId` optional, else a Privy token.
 * @returns 200 with `{ status, entries }`.
 */
export async function getRecentEditedHandler(request: Request) {
  const headers = getCorsHeaders();
  try {
    let { userId } = validateRecentEditedQuery(request);
    if (!userId) {
      const auth = await authenticateRequest(request);
      if (!(auth instanceof NextResponse)) userId = auth.userId;
    }
    if (!userId) return NextResponse.json({ status: "ok", entries: [] }, { headers });
    const rows = await listRecentEdited(userId);
    const images = await getArtistImages(
      rows.flatMap(row =>
        row.artistId
          ? [
              {
                id: row.artistId,
                customImage: row.customImage,
                spotify: row.spotifyId,
                deezer: row.deezerId,
              },
            ]
          : [],
      ),
    );
    const entries = rows.map(row => ({
      ...row,
      imageUrl: images.get(row.artistId ?? "") ?? null,
    }));
    return NextResponse.json({ status: "ok", entries }, { headers });
  } catch (error) {
    console.error("[recentEdited] error", error);
    return NextResponse.json({ status: "ok", entries: [] }, { headers });
  }
}
