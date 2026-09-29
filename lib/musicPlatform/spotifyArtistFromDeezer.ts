import { ISRC_FETCH_TIMEOUT_MS } from "@/lib/musicPlatform/const";
import { isrcsFromDeezer } from "@/lib/musicPlatform/isrcsFromDeezer";
import type { IsrcSpotifyMatch } from "@/lib/musicPlatform/types";
import { fetchJson } from "@/lib/networking/fetchJson";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { foldName } from "@/lib/text/foldName";

/**
 * Which Spotify artist is this, given their Deezer id? An ISRC identifies a
 * recording, not a person, so asking who Spotify credits on the records
 * Deezer attributes to this id doesn't depend on the name being rare (three
 * artists here are called Black Dave).
 *
 * The first credited artist isn't trusted: Pete Rango's top track credits
 * Dame Atlas first. Agreement across two or more recordings decides; a tie or
 * a single recording is only accepted when the name matches.
 *
 * @param deezerArtistId - The Deezer artist id.
 * @param artistName - The artist's name, for tie-breaking.
 * @returns The match, or null rather than a guess. Never throws.
 */
export async function spotifyArtistFromDeezer(
  deezerArtistId: string,
  artistName: string,
): Promise<IsrcSpotifyMatch | null> {
  try {
    const isrcs = await isrcsFromDeezer(deezerArtistId);
    if (isrcs.length === 0) return null;
    const { headers } = await getSpotifyHeaders();
    const counts = new Map<string, { n: number; name: string }>();
    await Promise.all(
      isrcs.map(async isrc => {
        const found = await fetchJson(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(`isrc:${isrc}`)}&type=track&limit=1`,
          { headers: { Authorization: headers.Authorization }, timeoutMs: ISRC_FETCH_TIMEOUT_MS },
        );
        const track = ((found?.tracks as { items?: unknown[] } | undefined)?.items ?? [])[0] as
          { artists?: { id?: string; name?: string }[] } | undefined;
        for (const a of track?.artists ?? []) {
          if (!a?.id) continue;
          const prev = counts.get(a.id) ?? { n: 0, name: a.name ?? "" };
          counts.set(a.id, { n: prev.n + 1, name: prev.name || (a.name ?? "") });
        }
      }),
    );
    if (counts.size === 0) return null;
    const ranked = [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
    const [topId, top] = ranked[0];
    const contested = ranked.filter(([, v]) => v.n === top.n);
    // One recording can't agree with itself: `top.n >= 2` is the whole rule.
    if (contested.length === 1 && top.n >= 2)
      return { spotifyId: topId, recordings: top.n, byName: false };
    const want = foldName(artistName);
    const named = contested.filter(([, v]) => foldName(v.name) === want);
    if (named.length === 1)
      return { spotifyId: named[0][0], recordings: named[0][1].n, byName: true };
    return null;
  } catch (e) {
    console.error("[spotifyArtistFromDeezer] Deezer -> Spotify resolution failed:", e);
    return null;
  }
}
