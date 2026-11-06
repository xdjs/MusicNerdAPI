import { CATALOG_LINES } from "@/lib/lore/const";
import { getSpotifyCatalogDetail } from "@/lib/spotify/getSpotifyCatalogDetail";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";

/**
 * The artist's real catalog from Spotify, authoritative for titles and release
 * dates. Before this, a release was dated by the year of the article that
 * mentioned it. Reference data, never a numbered source.
 *
 * @param spotifyId - The artist's Spotify id.
 * @returns The prompt block, or null with no catalog. Never throws: the sources are the substance, this is grounding.
 */
export async function catalogBlock(
  spotifyId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    signal?.throwIfAborted();
    const headers = signal ? await getSpotifyHeaders(signal) : await getSpotifyHeaders();
    const catalog = signal
      ? await getSpotifyCatalogDetail(spotifyId, headers, signal)
      : await getSpotifyCatalogDetail(spotifyId, headers);
    if (catalog.length === 0) return null;
    const lines = catalog
      .slice(0, CATALOG_LINES)
      .map(
        r =>
          `${(r.releaseDate ?? "date unknown").padEnd(12)} ${(r.kind ?? "release").padEnd(11)} ${r.name}`,
      );
    return (
      `\n--- VERIFIED CATALOG (the artist's own Spotify — authoritative for titles and release dates) ---\n` +
      `This is reference data, NOT a numbered source. Never cite it. Never write "[VERIFIED CATALOG]" or any marker for it.\n` +
      `${lines.join("\n")}\n--- END CATALOG ---`
    );
  } catch (e) {
    console.error("[catalogBlock] Spotify catalog unavailable:", e);
    return null;
  }
}
