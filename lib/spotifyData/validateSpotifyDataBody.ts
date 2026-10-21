import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { SPOTIFY_BATCH_MAX } from "@/lib/spotifyData/const";

/**
 * The POST body: a non-empty `spotifyIds` array, trimmed and de-duplicated,
 * at most 50, as MusicNerdWeb read it.
 *
 * @param body - The parsed JSON body.
 * @returns The ids, or a 400 with MusicNerdWeb's message.
 */
export function validateSpotifyDataBody(body: unknown): string[] | NextResponse {
  const headers = getCorsHeaders();
  const result = z.object({ spotifyIds: z.array(z.string()).min(1) }).safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: "spotifyIds array is required" }, { status: 400, headers });
  const cleaned = [...new Set(result.data.spotifyIds.map(id => id.trim()).filter(Boolean))];
  if (cleaned.length === 0)
    return NextResponse.json({ error: "No valid Spotify IDs provided" }, { status: 400, headers });
  if (cleaned.length > SPOTIFY_BATCH_MAX)
    return NextResponse.json(
      { error: "Maximum 50 IDs allowed per request" },
      { status: 400, headers },
    );
  return cleaned;
}
