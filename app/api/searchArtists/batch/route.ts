import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { searchArtistsByName } from "@/lib/search/searchArtistsByName";

export const dynamic = "force-dynamic";

// Simple in-memory cache for batch search results (5 minute TTL)
const searchCache = new Map<string, { results: unknown[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Normalise text for match scoring: lower-case, remove accents and punctuation.
 *
 * @param input - The raw input string.
 * @returns The normalised string.
 */
function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .toLowerCase();
}

/**
 * Score how closely an artist name matches the search query (normalised).
 *
 * @param name - The artist name.
 * @param query - The search query.
 * @returns 0 (exact) through 3 (fuzzy only).
 */
function getMatchScore(name: string, query: string) {
  const nameNorm = normalizeText(name);
  const queryNorm = normalizeText(query);
  if (nameNorm === queryNorm) return 0;
  if (nameNorm.startsWith(queryNorm)) return 1;
  if (nameNorm.includes(queryNorm)) return 2;
  return 3;
}

/**
 * CORS preflight for the batch search endpoint.
 *
 * @returns Empty 200 with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Batch search: best DB match per artist name.
 *
 * @param req - POST body with `{ query: { artists: string[] } }`.
 * @returns Best match (or null) per queried name.
 */
export async function POST(req: Request) {
  const headers = getCorsHeaders();
  try {
    const body = await req.json();
    const { query } = body;
    const artists: string[] = Array.isArray(query?.artists)
      ? query.artists
      : typeof query?.artist === "string"
        ? [query.artist]
        : [];

    const cleaned = [...new Set(artists.map((q: string) => q.trim()).filter(Boolean))];
    if (cleaned.length === 0) {
      return NextResponse.json({ error: "No queries provided" }, { status: 400, headers });
    }

    const cacheKey = JSON.stringify(cleaned);
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ results: cached.results }, { headers });
    }

    const timeoutPromise = new Promise<NextResponse>((_, reject) =>
      setTimeout(() => reject(new Error("Search timeout")), 12_000),
    );

    const searchOperation = async (): Promise<NextResponse> => {
      const perArtist = await Promise.all(
        cleaned.map(async q => {
          const rows = await searchArtistsByName(q);
          const [best] = rows
            .map(r => ({
              ...r,
              bio: null,
              isSpotifyOnly: false,
              matchScore: getMatchScore(r.name || "", q),
            }))
            .sort((a, b) =>
              a.matchScore !== b.matchScore
                ? a.matchScore - b.matchScore
                : (a.name || "").localeCompare(b.name || ""),
            );
          return best ?? null;
        }),
      );

      searchCache.set(cacheKey, { results: perArtist, timestamp: Date.now() });
      return NextResponse.json({ results: perArtist }, { headers });
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
  }
}
