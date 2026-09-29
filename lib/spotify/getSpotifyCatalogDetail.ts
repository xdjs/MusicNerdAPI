import type { SpotifyHeaders, SpotifyRelease } from "@/lib/spotify/types";

/**
 * The artist's releases on Spotify, with their real dates: albums, singles and
 * appearances, one per title, newest first.
 *
 * @param id - The artist's Spotify id.
 * @param headers - Bearer headers from `getSpotifyHeaders`.
 * @returns The releases; [] with no id or on any error.
 */
export async function getSpotifyCatalogDetail(
  id: string | null,
  headers: SpotifyHeaders,
): Promise<SpotifyRelease[]> {
  if (!id) return [];
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/artists/${id}/albums?include_groups=album%2Csingle%2Cappears_on&limit=50&market=US`,
      { headers: headers.headers },
    );
    if (!res.ok) throw new Error(`Spotify returned ${res.status}`);
    const data = (await res.json()) as {
      items?: Array<{
        name?: string;
        release_date?: string;
        album_group?: string;
        external_urls?: { spotify?: string };
      }>;
    };
    const seen = new Set<string>();
    const out: SpotifyRelease[] = [];
    for (const a of data.items ?? []) {
      if (!a.name) continue;
      const key = a.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: a.name,
        releaseDate: a.release_date ?? null,
        kind: a.album_group ?? null,
        url: a.external_urls?.spotify ?? null,
      });
    }
    out.sort((x, y) => (y.releaseDate ?? "").localeCompare(x.releaseDate ?? ""));
    return out;
  } catch (e) {
    console.error("[getSpotifyCatalogDetail] Error:", e);
    return [];
  }
}
