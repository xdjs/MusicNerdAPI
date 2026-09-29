import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { db } from "@/lib/db/db";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import type { ArtistOperationOwnership } from "@/lib/ownership/types";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { runSourceSearch } from "@/lib/vault/runSourceSearch";
import type { SourceSearchOptions, VaultSource } from "@/lib/vault/types";

/**
 * A source search for the artist, run as an artist operation so every write
 * re-checks the claim it started under. It takes the running operation's
 * ownership when there is one (a queued job's), else the approved claim now.
 * The search is recorded as activity unless the operation already carries one,
 * and every source it adds is attributed to it with origin `research`.
 *
 * @param artistId - The artist.
 * @param opts - The deadline, and whether a failure must throw.
 * @returns The sources it saved.
 */
export async function searchAndPopulateVault(
  artistId: string,
  opts: SourceSearchOptions = {},
): Promise<VaultSource[]> {
  const ownership: ArtistOperationOwnership = getArtistOperationOwnership(artistId) ?? {
    expectedClaimId: (await findApprovedClaim(db, artistId))?.id ?? null,
  };
  return withArtistOperation(artistId, ownership, async () => {
    const activityId =
      ownership.activityId ?? (await recordArtistActivity(artistId, "source_search"));
    return withArtistOperation(
      artistId,
      { ...ownership, activityId, sourceOrigin: "research" },
      () => runSourceSearch(artistId, opts),
    );
  });
}
