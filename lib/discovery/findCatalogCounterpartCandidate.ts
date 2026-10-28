import { resolveCatalogCounterpart } from "@/lib/musicPlatform/resolveCatalogCounterpart";
import type { TierCandidate } from "@/lib/discovery/types";

/** Propose only a corroborated counterpart; retain distinct nonmatch outcomes in discovery diagnostics. */
export async function findCatalogCounterpartCandidate(
  artistName: string,
  platform: "spotify" | "deezer",
  sourceId: string,
): Promise<TierCandidate | null> {
  const result = await resolveCatalogCounterpart({
    artistName,
    ...(platform === "spotify" ? { deezerId: sourceId } : { spotifyId: sourceId }),
  });
  if (result.status !== "verified") {
    console.info("[profileDiscovery] catalog counterpart", { platform, outcome: result.status });
    return null;
  }
  return {
    tier: 2,
    platform,
    url:
      platform === "spotify"
        ? `https://open.spotify.com/artist/${result.spotifyId}`
        : `https://www.deezer.com/artist/${result.deezerId}`,
    reasoning: `Verified across ${result.recordings} distinct recordings (ISRC) and uncontested artist credits`,
  };
}
