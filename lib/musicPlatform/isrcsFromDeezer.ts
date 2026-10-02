import { DEEZER_API, ISRC_FETCH_TIMEOUT_MS, ISRC_MAX_TRACKS } from "@/lib/musicPlatform/const";
import { fetchJson } from "@/lib/networking/fetchJson";

/**
 * The ISRCs of an artist's most popular Deezer recordings. The track calls run
 * concurrently: five in sequence would cost more than a whole discovery tier.
 *
 * @param deezerArtistId - The Deezer artist id.
 * @returns Distinct ISRCs; empty when Deezer has none.
 */
export async function isrcsFromDeezer(deezerArtistId: string): Promise<string[]> {
  const top = await fetchJson(
    `${DEEZER_API}/artist/${encodeURIComponent(deezerArtistId)}/top?limit=${ISRC_MAX_TRACKS}`,
    { timeoutMs: ISRC_FETCH_TIMEOUT_MS },
  );
  const tracks = (top?.data as { id?: unknown }[] | undefined) ?? [];
  const ids = tracks
    .map(t => t.id)
    .filter(id => typeof id === "number" || typeof id === "string")
    .slice(0, ISRC_MAX_TRACKS);
  const isrcs = await Promise.all(
    ids.map(async id => {
      const track = await fetchJson(`${DEEZER_API}/track/${encodeURIComponent(String(id))}`, {
        timeoutMs: ISRC_FETCH_TIMEOUT_MS,
      });
      const isrc = track?.isrc;
      return typeof isrc === "string" && isrc ? isrc : null;
    }),
  );
  return [...new Set(isrcs.filter((v): v is string => !!v))];
}
