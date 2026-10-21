import { NextResponse } from "next/server";
import { withTimeout } from "@/lib/async/withTimeout";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { SPOTIFY_BATCH_TIMEOUT_MS } from "@/lib/spotifyData/const";
import { getSpotifyArtistsData } from "@/lib/spotifyData/getSpotifyArtistsData";
import { validateSpotifyDataBody } from "@/lib/spotifyData/validateSpotifyDataBody";

/**
 * Handles POST /api/getSpotifyData with MusicNerdWeb's shapes: `{ data }`
 * for up to 50 `spotifyIds`, with a 12-second limit.
 *
 * @param request - The POST request.
 * @returns 200 `{ data }`, or 400, 408 or 500 `{ error }`.
 */
export async function postSpotifyDataHandler(request: Request): Promise<Response> {
  const headers = getCorsHeaders();
  try {
    const cleaned = validateSpotifyDataBody(await request.json());
    if (cleaned instanceof NextResponse) return cleaned;
    const fetchOperation = async () => {
      const spotifyHeaders = await getSpotifyHeaders();
      return getSpotifyArtistsData(cleaned, spotifyHeaders);
    };
    const artists = await withTimeout(
      fetchOperation(),
      SPOTIFY_BATCH_TIMEOUT_MS,
      "Request timeout",
    );
    return NextResponse.json({ data: artists }, { headers });
  } catch (error) {
    console.error("Error in batch Spotify data fetch:", error);
    if (error instanceof Error && error.message === "Request timeout")
      return NextResponse.json({ error: "Request timed out" }, { status: 408, headers });
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}
