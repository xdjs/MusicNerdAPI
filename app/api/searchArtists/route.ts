import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { searchArtistsByName } from "@/lib/search/searchArtistsByName";

export const dynamic = "force-dynamic";

const LINK_FIELDS = [
  "bandcamp",
  "youtube",
  "youtubechannel",
  "instagram",
  "x",
  "facebook",
  "tiktok",
  "soundcloud",
  "patreon",
  "linktree",
  "spotifyusername",
  "bandsintown",
  "audius",
  "zora",
  "catalog",
  "opensea",
  "foundation",
  "mirror",
  "soundxyz",
  "twitch",
  "wikidata",
  "wikipedia",
  "subvert",
  "bluesky",
] as const;

/**
 * Count how many link fields are populated on an artist row.
 *
 * @param artist - The artist record.
 * @returns The number of non-empty link fields.
 */
function getLinkCount(artist: Record<string, unknown>): number {
  return LINK_FIELDS.reduce((count, field) => {
    const val = artist[field];
    return count + (val !== null && val !== undefined && val !== "" ? 1 : 0);
  }, 0);
}

/**
 * Score how closely an artist name matches the search query.
 *
 * @param name - The artist name to check.
 * @param query - The search query.
 * @returns 0 (exact) through 3 (fuzzy only).
 */
function getMatchScore(name: string, query: string) {
  const nameLower = name.toLowerCase();
  const queryLower = query.toLowerCase();
  if (nameLower === queryLower) return 0;
  if (nameLower.startsWith(queryLower)) return 1;
  if (nameLower.includes(queryLower)) return 2;
  return 3;
}

// Simple in-memory cache for search results (5 minute TTL)
const searchCache = new Map<string, { results: unknown[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * CORS preflight for the artist search endpoint.
 *
 * @returns Empty 200 with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Search the artist directory by name (database-only, no external platforms).
 *
 * @param req - POST body with `{ query: string, bookmarkedArtistIds?: string[] }`.
 * @returns Sorted search results.
 */
export async function POST(req: Request) {
  const headers = getCorsHeaders();
  const start = performance.now();
  try {
    const body = await req.json();
    const { query, bookmarkedArtistIds = [] } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Invalid query parameter" }, { status: 400, headers });
    }

    const bookmarkedIds: string[] = Array.isArray(bookmarkedArtistIds) ? bookmarkedArtistIds : [];

    const cacheKey = `${query}|${bookmarkedIds.sort().join(",")}`;
    const cachedResult = searchCache.get(cacheKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
      return NextResponse.json({ results: cachedResult.results }, { headers });
    }

    const timeoutPromise = new Promise<NextResponse>((_, reject) =>
      setTimeout(() => reject(new Error("Search timeout")), 12_000),
    );

    const searchOperation = async (): Promise<NextResponse> => {
      const dbResults = await searchArtistsByName(query);

      const dbArtistsWithImages = (dbResults ?? []).map(artist => ({
        ...artist,
        bio: null,
        isExternalOnly: false,
        imageUrl: artist.customImage ?? null,
        matchScore: getMatchScore(artist.name || "", query),
        linkCount: getLinkCount(artist as unknown as Record<string, unknown>),
      }));

      const combinedResults = dbArtistsWithImages.sort((a, b) => {
        if (a.matchScore !== b.matchScore) return a.matchScore - b.matchScore;
        const aIsBookmarked = bookmarkedIds.includes(a.id || "");
        const bIsBookmarked = bookmarkedIds.includes(b.id || "");
        if (aIsBookmarked !== bIsBookmarked) return bIsBookmarked ? 1 : -1;
        if ((a.linkCount ?? 0) !== (b.linkCount ?? 0))
          return (b.linkCount ?? 0) - (a.linkCount ?? 0);
        return (a.name || "").localeCompare(b.name || "");
      });

      searchCache.set(cacheKey, { results: combinedResults, timestamp: Date.now() });
      return NextResponse.json({ results: combinedResults }, { headers });
    };

    return await Promise.race([searchOperation(), timeoutPromise]);
  } catch (error) {
    if (error instanceof Error && error.message === "Search timeout") {
      return NextResponse.json(
        { error: "Search timed out. Please try a more specific search term." },
        { status: 408, headers },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  } finally {
    const end = performance.now();
    console.debug(`[searchArtists] POST took ${end - start}ms`);
  }
}
