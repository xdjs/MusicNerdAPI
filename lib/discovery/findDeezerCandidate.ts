import { pickExactNameMatch } from "@/lib/discovery/pickExactNameMatch";
import type { TierCandidate } from "@/lib/discovery/types";
import { searchDeezerArtists } from "@/lib/musicPlatform/searchDeezerArtists";

/**
 * Tier 2 for Deezer: an exact-name match from Deezer's search.
 *
 * @param artistName - The resolved name.
 * @returns A candidate, or null; never throws.
 */
export async function findDeezerCandidate(artistName: string): Promise<TierCandidate | null> {
  try {
    const best = pickExactNameMatch(await searchDeezerArtists(artistName, 5), artistName);
    if (!best) return null;
    return {
      tier: 2,
      platform: "deezer",
      url: best.profileUrl,
      reasoning: `Exact name match via Deezer search (${best.followerCount ?? 0} fans)`,
    };
  } catch (e) {
    console.error("[profileDiscovery] tier2 deezer search failed:", e);
    return null;
  }
}
