import { DEEZER_API, DEEZER_TIMEOUT_MS } from "@/lib/musicPlatform/const";
import { isDeezerError } from "@/lib/musicPlatform/isDeezerError";
import { isValidDeezerId } from "@/lib/musicPlatform/isValidDeezerId";
import { fetchJson } from "@/lib/networking/fetchJson";

/**
 * The title of a Deezer artist's top track.
 *
 * @param id - The Deezer artist id.
 * @returns The title, or null.
 */
export async function fetchDeezerTopTrack(id: string): Promise<string | null> {
  if (!isValidDeezerId(id)) return null;
  const data = await fetchJson(`${DEEZER_API}/artist/${id}/top?limit=1`, {
    timeoutMs: DEEZER_TIMEOUT_MS,
  });
  if (!data || isDeezerError(data)) return null;
  return (data.data as { title?: string }[] | undefined)?.[0]?.title ?? null;
}
