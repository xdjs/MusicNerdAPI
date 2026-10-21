import type { LinkDecisionRun } from "@/lib/onboarding/types";
import { getArtistById } from "@/lib/artists/getArtistById";
import { hasVerifiedDeezerPair } from "@/lib/providerIdentity/hasVerifiedDeezerPair";

/** Automatic guesses need independent exact-pair evidence; explicit confirmations bypass this gate. */
export async function automaticDeezerIdentityIsBlocked(
  run: LinkDecisionRun,
  deezerId: string,
): Promise<boolean> {
  delete run.deezerWriteEvidence;
  try {
    const artist = await getArtistById(run.artistId);
    if (artist?.deezer && artist.deezer !== deezerId) return true;
    if (!artist?.spotify || !(await hasVerifiedDeezerPair(artist.spotify, deezerId))) return true;
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
