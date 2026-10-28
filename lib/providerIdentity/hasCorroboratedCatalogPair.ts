import { hasVerifiedDeezerPair } from "@/lib/providerIdentity/hasVerifiedDeezerPair";
import { resolveCatalogCounterpart } from "@/lib/musicPlatform/resolveCatalogCounterpart";

/** Preserve unique Wikidata proof; otherwise require the exact pair to share verified recording credits. */
export async function hasCorroboratedCatalogPair(
  spotifyId: string,
  deezerId: string,
  artistName: string,
): Promise<boolean> {
  if (await hasVerifiedDeezerPair(spotifyId, deezerId)) return true;
  const result = await resolveCatalogCounterpart({ spotifyId, deezerId, artistName });
  return (
    result.status === "verified" && result.spotifyId === spotifyId && result.deezerId === deezerId
  );
}
