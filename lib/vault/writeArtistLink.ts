import { automaticDeezerIdentityIsBlocked } from "@/lib/providerIdentity/automaticDeezerIdentityIsBlocked";
import { automaticSpotifyIdentityIsBlocked } from "@/lib/providerIdentity/automaticSpotifyIdentityIsBlocked";
import type { LinkDecisionRun } from "@/lib/onboarding/types";
import { setDiscoveredArtistLink } from "@/lib/artistLinkReview/setDiscoveredArtistLink";

/**
 * Writes a link, then stops calling the column provisional and updates the
 * in-memory snapshot, so a later gate in the same run sees the answer. Without
 * this, one run wrote bandcamp three times for Sherwinn Brice and the last,
 * another artist's, won. Every link write in the search goes through here.
 *
 * @param artistId - The artist.
 * @param siteName - The platform column.
 * @param value - The handle or id.
 * @param provisional - Columns still holding a guess; the written one is removed.
 * @param record - The snapshot the gates read; the written value is set on it.
 * @returns Once written; throws when the guarded write refuses the candidate.
 */
export async function writeArtistLink(
  artistId: string,
  siteName: string,
  value: string,
  provisional?: Set<string>,
  record?: Record<string, unknown>,
): Promise<void> {
  if (siteName === "spotify" || siteName === "deezer") {
    const run: LinkDecisionRun = { artistId };
    const blocked =
      siteName === "spotify"
        ? await automaticSpotifyIdentityIsBlocked(run, value)
        : await automaticDeezerIdentityIsBlocked(run, value);
    const evidence = siteName === "spotify" ? run.spotifyWriteEvidence : run.deezerWriteEvidence;
    if (blocked || !evidence) throw new Error("Automatic catalog identity not corroborated");
    await setDiscoveredArtistLink(artistId, siteName, value, evidence);
  } else {
    await setDiscoveredArtistLink(artistId, siteName, value);
  }
  provisional?.delete(siteName);
  if (record) record[siteName] = value;
}
