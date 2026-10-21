import { NextResponse } from "next/server";
import { normalizeStoredArtistImage } from "@/lib/artists/normalizeStoredArtistImage";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { authenticateProfileRequest } from "@/lib/profile/authenticateProfileRequest";
import { PROFILE_ARTISTS_PAGE_SIZE } from "@/lib/profile/const";
import { getContributedArtists } from "@/lib/profile/getContributedArtists";
import { validateProfileArtistsQuery } from "@/lib/profile/validateProfileArtistsQuery";

/**
 * GET /api/profile/artists: a page of the artists the caller contributed to.
 *
 * @param request - The request: a Privy bearer token, `X-Profile-Account`, and optional `offset` and `q`.
 * @returns 200 `{ status: "ok", userId, artists, total, next }`, or 400, 401, 409 or 503.
 */
export async function getProfileArtistsHandler(request: Request) {
  const auth = await authenticateProfileRequest(request);
  if (auth instanceof NextResponse) return auth;
  const query = validateProfileArtistsQuery(request);
  if (query instanceof NextResponse) return query;
  const headers = getCorsHeaders();
  try {
    const { offset } = query;
    const result = await getContributedArtists(auth.userId, {
      offset,
      limit: PROFILE_ARTISTS_PAGE_SIZE,
      query: query.query,
    });
    const next = offset + result.artists.length;
    return NextResponse.json(
      {
        status: "ok",
        userId: auth.userId,
        artists: result.artists.map(artist => ({
          artistId: artist.id,
          artistName: artist.name || "Unknown artist",
          imageUrl: normalizeStoredArtistImage(artist.customImage),
        })),
        total: result.total,
        next: next < result.total ? next : null,
      },
      { headers: { ...headers, "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error", error: "Could not load your artists" },
      { status: 503, headers },
    );
  }
}
