import { getArtistById } from "@/lib/artists/getArtistById";
import { propagateVerifiedHandles } from "@/lib/vault/propagateVerifiedHandles";
import type { SearchRun } from "@/lib/vault/types";

/**
 * Probes the platforms the artist has nothing for with every handle the run
 * proved, once for the run. When MusicBrainz identified the artist outright,
 * it doesn't guess at the platforms MusicBrainz didn't name.
 *
 * @param run - The run, for its verified handles and deadline.
 * @param authoritative - MusicBrainz matched the artist by an identifier we hold.
 * @returns Nothing.
 */
export async function propagateRunHandles(run: SearchRun, authoritative: boolean): Promise<void> {
  if (authoritative) {
    console.log(
      `[vaultWebSearch] MusicBrainz identified "${run.artistName}" outright — not guessing at the platforms it did not name`,
    );
    return;
  }
  if (run.verifiedHandles.size === 0) return;
  const latest = await getArtistById(run.artistId).catch(() => undefined);
  if (!latest) return;
  await propagateVerifiedHandles(
    run.artistId,
    run.verifiedHandles,
    latest as Record<string, unknown>,
    run.artistName,
    run.deadline,
    run.provisional,
  );
}
