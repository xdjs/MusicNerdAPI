import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { SpotifyDeferredError } from "@/lib/spotify/SpotifyDeferredError";
import { SPOTIFY_ARTIST_CACHE_TTL_MS, spotifyArtistCache } from "@/lib/spotifyData/const";
import { getSpotifyArtistData } from "@/lib/spotifyData/getSpotifyArtistData";
import { getSpotifyArtistsData } from "@/lib/spotifyData/getSpotifyArtistsData";
import { validateSpotifyDataQuery } from "@/lib/spotifyData/validateSpotifyDataQuery";

/**
 * Handles GET /api/getSpotifyData with MusicNerdWeb's shapes: `{ data }` for
 * one `spotifyId` or a comma-separated `spotifyIds` batch, `{ error }`
 * otherwise. A successful single answer is kept for 24 hours, as MusicNerdWeb
 * kept it; a batch always asks Spotify. During Spotify's shared cooldown no
 * token can be fetched, so the answer is a 503 with `Retry-After`.
 *
 * @param request - The GET request.
 * @returns 200 `{ data }`, or 400, 502 or 503 `{ error }`.
 */
export async function getSpotifyDataHandler(request: Request): Promise<Response> {
  const cors = getCorsHeaders();
  const query = validateSpotifyDataQuery(new URL(request.url).searchParams);
  if (query instanceof NextResponse) return query;

  if ("spotifyIds" in query) {
    try {
      const headers = await getSpotifyHeaders();
      const artists = await getSpotifyArtistsData(query.spotifyIds, headers);
      return NextResponse.json({ data: artists }, { headers: cors });
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch artist data" },
        { status: 502, headers: cors },
      );
    }
  }

  const hit = spotifyArtistCache.get(query.spotifyId);
  if (hit && Date.now() - hit.at < SPOTIFY_ARTIST_CACHE_TTL_MS)
    return NextResponse.json({ data: hit.data }, { headers: cors });

  const noStore = { ...cors, "Cache-Control": "no-store" };
  try {
    const headers = await getSpotifyHeaders();
    const { data, error } = await getSpotifyArtistData(query.spotifyId, headers);
    if (error) return NextResponse.json({ error }, { status: 502, headers: noStore });
    if (data) spotifyArtistCache.set(query.spotifyId, { at: Date.now(), data });
    return NextResponse.json({ data }, { headers: cors });
  } catch (error) {
    if (error instanceof SpotifyDeferredError)
      return NextResponse.json(
        { error: "Spotify is temporarily rate limited. Please try again later." },
        {
          status: 503,
          headers: {
            ...noStore,
            "Retry-After": String(Math.max(1, Math.ceil((error.retryAtMs - Date.now()) / 1000))),
          },
        },
      );
    return NextResponse.json(
      { error: "Failed to fetch artist data" },
      { status: 502, headers: noStore },
    );
  }
}
