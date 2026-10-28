import { DEEZER_API, ISRC_FETCH_TIMEOUT_MS, ISRC_MAX_TRACKS } from "@/lib/musicPlatform/const";
import { fetchJson } from "@/lib/networking/fetchJson";

/**
 * The ISRCs of an artist's most popular Deezer recordings. The track calls run
 * concurrently: five in sequence would cost more than a whole discovery tier.
 *
 * @param deezerArtistId - The Deezer artist id.
 * @returns Distinct ISRCs; empty when Deezer has none.
 */
export async function isrcsFromDeezer(deezerArtistId: string, strict = false): Promise<string[]> {
  const top = await fetchJson(
    `${DEEZER_API}/artist/${encodeURIComponent(deezerArtistId)}/top?limit=${ISRC_MAX_TRACKS}`,
    { timeoutMs: ISRC_FETCH_TIMEOUT_MS },
  );
  if (strict && (!top || top.error || !Array.isArray(top.data)))
    throw new Error("Deezer tracks unavailable");
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
      if (strict && (!track || track.error || String(track.id) !== String(id)))
        throw new Error("Deezer recording unavailable");
      if (strict) {
        const contributors = (Array.isArray(track?.contributors) ? track.contributors : []) as {
          id?: unknown;
          role?: unknown;
        }[];
        const primary = track?.artist as { id?: unknown } | undefined;
        const credited =
          String(primary?.id) === deezerArtistId ||
          contributors.some(
            artist =>
              String(artist?.id) === deezerArtistId &&
              (artist.role === "Main" || artist.role === "Featured"),
          );
        if (!credited) throw new Error("Deezer recording does not credit source artist");
      }
      const isrc = track?.isrc;
      return typeof isrc === "string" && isrc && (!strict || /^[A-Z0-9]{12}$/i.test(isrc))
        ? isrc.toUpperCase()
        : null;
    }),
  );
  return [...new Set(isrcs.filter((v): v is string => !!v))];
}
