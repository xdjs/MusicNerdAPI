import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { SPOTIFY_BATCH_MAX } from "@/lib/spotifyData/const";

/**
 * The GET query: a batch of comma-separated `spotifyIds` (at most 50) when
 * sent, else one `spotifyId`, as MusicNerdWeb read them.
 *
 * @param searchParams - The request's query.
 * @returns `{ spotifyIds }` or `{ spotifyId }`, or a 400 with MusicNerdWeb's message.
 */
export function validateSpotifyDataQuery(
  searchParams: URLSearchParams,
): { spotifyId: string } | { spotifyIds: string[] } | NextResponse {
  const headers = getCorsHeaders();
  const { spotifyId, spotifyIds } = z
    .object({ spotifyId: z.string().trim().optional(), spotifyIds: z.string().optional() })
    .parse({
      spotifyId: searchParams.get("spotifyId") ?? undefined,
      spotifyIds: searchParams.get("spotifyIds") ?? undefined,
    });
  const ids = spotifyIds
    ?.split(",")
    .map(id => id.trim())
    .filter(Boolean);
  if (ids && ids.length > 0) {
    if (ids.length > SPOTIFY_BATCH_MAX)
      return NextResponse.json(
        { error: "Maximum 50 IDs allowed per request" },
        { status: 400, headers },
      );
    return { spotifyIds: ids };
  }
  if (!spotifyId)
    return NextResponse.json(
      { error: "spotifyId or spotifyIds is required" },
      { status: 400, headers },
    );
  return { spotifyId };
}
