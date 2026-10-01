import { DEEZER_API, DEEZER_TIMEOUT_MS } from "@/lib/musicPlatform/const";
import { isDeezerError } from "@/lib/musicPlatform/isDeezerError";
import { mapDeezerArtist } from "@/lib/musicPlatform/mapDeezerArtist";
import type { DeezerArtistPayload, MusicPlatformArtist } from "@/lib/musicPlatform/types";
import { fetchJson } from "@/lib/networking/fetchJson";

/**
 * Deezer's artist search by name.
 *
 * @param query - The artist name.
 * @param limit - Maximum results.
 * @returns The matches, without top tracks; empty for an empty query or any failure.
 */
export async function searchDeezerArtists(
  query: string,
  limit: number,
): Promise<MusicPlatformArtist[]> {
  if (!query?.trim()) return [];
  const data = await fetchJson(
    `${DEEZER_API}/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`,
    { timeoutMs: DEEZER_TIMEOUT_MS },
  );
  if (!data) {
    console.error("[searchDeezerArtists] Search request failed");
    return [];
  }
  if (isDeezerError(data)) {
    console.error("[searchDeezerArtists] Search error:", data.error);
    return [];
  }
  return ((data.data as DeezerArtistPayload[] | undefined) ?? []).map(artist =>
    mapDeezerArtist(artist, null),
  );
}
