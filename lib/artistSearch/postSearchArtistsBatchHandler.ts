import { NextResponse } from "next/server";
import {
  SEARCH_CACHE_TTL_MS,
  SEARCH_TIMEOUT_MS,
  searchArtistsBatchCache,
} from "@/lib/artistSearch/const";
import { getNormalisedMatchScore } from "@/lib/artistSearch/getNormalisedMatchScore";
import { searchForArtistByName } from "@/lib/artistSearch/searchForArtistByName";
import type { BatchSearchArtistResult } from "@/lib/artistSearch/types";
import { validateSearchArtistsBatchBody } from "@/lib/artistSearch/validateSearchArtistsBatchBody";
import { withTimeout } from "@/lib/async/withTimeout";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/searchArtists/batch with MusicNerdWeb's shapes: the best
 * Music Nerd match per name, in request order, kept for five minutes per
 * list, with a 12-second limit on the whole search.
 *
 * @param request - The POST request.
 * @returns 200 `{ results }`, or 400, 408 or 500 `{ error }`.
 */
export async function postSearchArtistsBatchHandler(request: Request): Promise<Response> {
  const headers = getCorsHeaders();
  try {
    const cleaned = validateSearchArtistsBatchBody(await request.json());
    if (cleaned instanceof NextResponse) return cleaned;

    const cacheKey = JSON.stringify(cleaned);
    const cached = searchArtistsBatchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL_MS)
      return NextResponse.json({ results: cached.results }, { headers });

    const searchOperation = async (): Promise<(BatchSearchArtistResult | null)[]> =>
      Promise.all(
        cleaned.map(async q => {
          const rows = await searchForArtistByName(q);
          const [best] = rows
            .map(r => ({
              ...r,
              bio: null as null, // Do not retain claim-sensitive About in the search cache.
              isSpotifyOnly: false as const,
              matchScore: getNormalisedMatchScore(r.name || "", q),
            }))
            .sort((a, b) =>
              a.matchScore !== b.matchScore
                ? a.matchScore - b.matchScore
                : (a.name || "").localeCompare(b.name || ""),
            );
          return best ?? null;
        }),
      );
    const results = await withTimeout(searchOperation(), SEARCH_TIMEOUT_MS, "Search timeout");
    searchArtistsBatchCache.set(cacheKey, { results, timestamp: Date.now() });
    return NextResponse.json({ results }, { headers });
  } catch (error) {
    console.error("Error in search artists:", error);
    if (error instanceof Error && error.message === "Search timeout")
      return NextResponse.json(
        { error: "Search timed out. Please try a more specific search term." },
        { status: 408, headers },
      );
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}
