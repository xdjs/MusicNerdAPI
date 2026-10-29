import { sql } from "drizzle-orm";
import { artistDocCorrections } from "@/lib/db/schema";
import { withArtistUploadWrite } from "@/lib/ownership/withArtistUploadWrite";
import type { ArtistWriteAuth } from "@/lib/ownership/types";

/**
 * Saves a correction to the artist's Lore, re-authorized under the artist row
 * lock. Upserts on (artist, claim): correcting the same claim again replaces
 * the earlier correction instead of stacking two instructions.
 *
 * @param artistId - The artist.
 * @param claim - The claim as keyed (trimmed and capped).
 * @param kind - `wrong` or `fix`.
 * @param correction - The artist's wording for a fix, else null.
 * @param auth - The user and the claim the request started under.
 * @returns Nothing; throws OwnershipChangedError when the claim changed.
 */
export async function upsertDocCorrection(
  artistId: string,
  claim: string,
  kind: "wrong" | "fix",
  correction: string | null,
  auth: ArtistWriteAuth,
): Promise<void> {
  await withArtistUploadWrite(artistId, auth.userId, auth.expectedClaimId, async tx => {
    await tx
      .insert(artistDocCorrections)
      .values({ artistId, claim, kind, correction })
      .onConflictDoUpdate({
        target: [artistDocCorrections.artistId, artistDocCorrections.claim],
        set: { kind, correction, updatedAt: sql`(now() AT TIME ZONE 'utc'::text)` },
      });
  });
}
