import { DEEZER_API, DEEZER_TIMEOUT_MS } from "@/lib/musicPlatform/const";
import { isDeezerError } from "@/lib/musicPlatform/isDeezerError";
import { isValidDeezerId } from "@/lib/musicPlatform/isValidDeezerId";
import type { DeezerArtistPayload } from "@/lib/musicPlatform/types";
import { fetchJson } from "@/lib/networking/fetchJson";

/**
 * One Deezer artist. No cache, unlike MusicNerdWeb's `cachedOrDirect`: there
 * is no Next data cache here.
 *
 * @param id - The Deezer artist id.
 * @returns The artist, or null for a bad id, a Deezer error or a failed request.
 */
export async function fetchDeezerArtist(id: string): Promise<DeezerArtistPayload | null> {
  if (!isValidDeezerId(id)) return null;
  const data = await fetchJson(`${DEEZER_API}/artist/${id}`, { timeoutMs: DEEZER_TIMEOUT_MS });
  if (!data) {
    console.error(`[fetchDeezerArtist] Artist ${id} request failed`);
    return null;
  }
  if (isDeezerError(data)) {
    console.error(`[fetchDeezerArtist] Artist ${id} error:`, data.error);
    return null;
  }
  return data as unknown as DeezerArtistPayload;
}
