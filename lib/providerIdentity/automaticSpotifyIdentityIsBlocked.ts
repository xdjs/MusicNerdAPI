import type { LinkDecisionRun } from "@/lib/onboarding/types";
import { getArtistById } from "@/lib/artists/getArtistById";
import { hasVerifiedDeezerPair } from "@/lib/providerIdentity/hasVerifiedDeezerPair";

/** Generic discovery cannot attach Spotify from a name or an unverified candidate label. */
export async function automaticSpotifyIdentityIsBlocked(
  run: LinkDecisionRun,
  spotifyId: string,
): Promise<boolean> {
  delete run.spotifyWriteEvidence;
  try {
    const artist = await getArtistById(run.artistId);
    if (artist?.spotify && artist.spotify !== spotifyId) return true;
    if (!artist?.deezer || !(await hasVerifiedDeezerPair(spotifyId, artist.deezer))) return true;
    run.spotifyWriteEvidence = {
      spotifyId,
      deezerId: artist.deezer,
      previousSpotifyId: artist.spotify ?? null,
    };
    return false;
  } catch {
    return true;
  }
}
