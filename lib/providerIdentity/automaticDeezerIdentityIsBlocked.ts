import type { LinkDecisionRun } from "@/lib/onboarding/types";
import { getArtistById } from "@/lib/artists/getArtistById";
import { hasCorroboratedCatalogPair } from "@/lib/providerIdentity/hasCorroboratedCatalogPair";

/** Automatic guesses need independent exact-pair evidence; explicit confirmations bypass this gate. */
export async function automaticDeezerIdentityIsBlocked(
  run: LinkDecisionRun,
  deezerId: string,
): Promise<boolean> {
  delete run.deezerWriteEvidence;
  try {
    const artist = await getArtistById(run.artistId);
    if (artist?.deezer && artist.deezer !== deezerId) return true;
    if (
      !artist?.spotify ||
      !(await hasCorroboratedCatalogPair(artist.spotify, deezerId, artist.name ?? ""))
    )
      return true;
    run.deezerWriteEvidence = {
      spotifyId: artist.spotify,
      deezerId,
      previousDeezerId: artist.deezer ?? null,
    };
    return false;
  } catch {
    return true;
  }
}
