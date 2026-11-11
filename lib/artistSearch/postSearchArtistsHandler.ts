import { NextResponse } from "next/server";
import {
  SEARCH_CACHE_TTL_MS,
  SEARCH_TIMEOUT_MS,
  searchArtistsCache,
} from "@/lib/artistSearch/const";
import { InvalidArtistSearchQueryError } from "@/lib/artistSearch/InvalidArtistSearchQueryError";
import { ProviderIdentityConflictError } from "@/lib/artistSearch/ProviderIdentityConflictError";
import { ProviderSearchUnavailableError } from "@/lib/artistSearch/ProviderSearchUnavailableError";
import { parseArtistSearchQuery } from "@/lib/artistSearch/parseArtistSearchQuery";
import { searchArtists } from "@/lib/artistSearch/searchArtists";
import { validateSearchArtistsBody } from "@/lib/artistSearch/validateSearchArtistsBody";
import { withTimeout } from "@/lib/async/withTimeout";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/searchArtists with MusicNerdWeb's shapes: `{ results }`
 * from the combined search, kept for five minutes per query and bookmark
 * list, with a 12-second limit on the whole search.
 *
 * @param request - The POST request.
 * @returns 200 `{ results }`, or 400, 408, 409, 500 or 503 `{ error }`.
 */
export async function postSearchArtistsHandler(request: Request): Promise<Response> {
  const headers = getCorsHeaders();
  try {
    const parsed = validateSearchArtistsBody(await request.json());
    if (parsed instanceof NextResponse) return parsed;
    const { query, bookmarkedArtistIds: bookmarkedIds } = parsed;

    // Bare IDs may return partial names during provider failure; retry identity next time.
    const cacheable = !parseArtistSearchQuery(query)?.includeNameResults;
    const cacheKey = `${query}|${[...bookmarkedIds].sort().join(",")}`;
    const cachedResult = cacheable ? searchArtistsCache.get(cacheKey) : undefined;
    if (cachedResult && Date.now() - cachedResult.timestamp < SEARCH_CACHE_TTL_MS)
      return NextResponse.json({ results: cachedResult.results }, { headers });

    const results = await withTimeout(
      searchArtists(query, bookmarkedIds),
      SEARCH_TIMEOUT_MS,
      "Search timeout",
    );
    if (cacheable) searchArtistsCache.set(cacheKey, { results, timestamp: Date.now() });
    return NextResponse.json({ results }, { headers });
  } catch (error) {
    if (
      error instanceof InvalidArtistSearchQueryError ||
      error instanceof ProviderIdentityConflictError ||
      error instanceof ProviderSearchUnavailableError
    )
      return NextResponse.json(
        { error: error.message },
        {
          status:
            error instanceof InvalidArtistSearchQueryError
              ? 400
              : error instanceof ProviderIdentityConflictError
                ? 409
                : 503,
          headers,
        },
      );
    console.error("Error in search artists:", error);
    if (error instanceof Error && error.message === "Search timeout")
      return NextResponse.json(
        { error: "Search timed out. Please try a more specific search term." },
        { status: 408, headers },
      );
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}
