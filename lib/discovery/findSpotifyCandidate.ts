import { pickExactNameMatch } from "@/lib/discovery/pickExactNameMatch";
import type { TierCandidate } from "@/lib/discovery/types";
import { searchSpotifyArtists } from "@/lib/musicPlatform/searchSpotifyArtists";
import { spotifyArtistFromDeezer } from "@/lib/musicPlatform/spotifyArtistFromDeezer";

/**
 * Tier 2 for Spotify: an id first, a name only if that fails. A name search
 * can't tell three Black Daves apart; shared recordings (by ISRC) with the
 * artist's Deezer catalogue can.
 *
 * @param artistName - The resolved name.
 * @param record - The artist row, for its Deezer id.
 * @returns A candidate, or null; never throws.
 */
export async function findSpotifyCandidate(
  artistName: string,
  record: Record<string, unknown>,
): Promise<TierCandidate | null> {
  try {
    const deezerId = typeof record.deezer === "string" ? record.deezer : "";
    if (deezerId) {
      const viaIsrc = await spotifyArtistFromDeezer(deezerId, artistName);
      if (viaIsrc) {
        return {
          tier: 2,
          platform: "spotify",
          // validateCandidate re-derives the canonical URL from urlmap.
          url: `https://open.spotify.com/artist/${viaIsrc.spotifyId}`,
          reasoning:
            `Shares ${viaIsrc.recordings} recording${viaIsrc.recordings === 1 ? "" : "s"} (by ISRC) with their Deezer catalogue` +
            (viaIsrc.byName ? ", name confirmed among the performers" : ""),
        };
      }
    }
    const best = pickExactNameMatch(await searchSpotifyArtists(artistName, 5), artistName);
    if (!best) return null;
    return {
      tier: 2,
      platform: "spotify",
      url: best.profileUrl,
      reasoning: `Exact name match via Spotify search (${best.followerCount ?? 0} followers)`,
    };
  } catch (e) {
    console.error("[profileDiscovery] tier2 spotify search failed:", e);
    return null;
  }
}
