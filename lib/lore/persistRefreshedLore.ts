import { limitAboutTransaction } from "@/lib/bio/limitAboutTransaction";
import type { AboutLoreLease } from "@/lib/bio/types";
import { assertLoreRefreshLease } from "@/lib/lore/assertLoreRefreshLease";
import { assertLoreSourcesCurrent } from "@/lib/lore/assertLoreSourcesCurrent";
import type { DocSource } from "@/lib/lore/types";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { artistDocs, artistResearchJobs } from "@/lib/db/schema";
import type { LoreSummary } from "@/lib/lore/types";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import type { ArtistWriteAuth } from "@/lib/ownership/types";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";

/**
 * Writes a rebuilt Lore, only if the claim it was built under is still the
 * approved one and (for a job) the lore_refresh job is still live. Revocation
 * takes the same artist row lock, so either this commits first and revocation
 * removes it, or this sees the revocation and writes nothing.
 *
 * @param artistId - The artist.
 * @param content - The document.
 * @param sources - Its numbered citation manifest.
 * @param expectedClaimId - The claim captured before the sources were read.
 * @param jobId - The lore_refresh job, when a job is writing.
 * @param loreSummary - The inventory overview: null clears it, undefined keeps the last good one.
 * @param auth - The explicit editor when preparation comes from About.
 * @param lease - Exact lease for explicit About preparation.
 * @returns True when written; false when ownership or the job changed.
 */
export async function persistRefreshedLore(
  artistId: string,
  content: string,
  sources: unknown[],
  expectedClaimId: string | null,
  jobId?: string,
  loreSummary?: LoreSummary | null,
  auth?: ArtistWriteAuth,
  lease?: AboutLoreLease,
  signal?: AbortSignal,
): Promise<boolean> {
  return db.transaction(async tx => {
    if (lease) await limitAboutTransaction(tx);
    await lockArtistRow(tx, artistId);
    if (auth) await authorizeLockedArtistWrite(tx, artistId, { ...auth, expectedClaimId });
    if (lease) await assertLoreRefreshLease(tx, artistId, lease);
    if (auth) await assertLoreSourcesCurrent(tx, artistId, sources as DocSource[]);
    const claim = await findApprovedClaim(tx, artistId);
    if ((claim?.id ?? null) !== expectedClaimId) return false;
    if (jobId) {
      const job = await tx.query.artistResearchJobs.findFirst({
        where: and(
          eq(artistResearchJobs.id, jobId),
          eq(artistResearchJobs.artistId, artistId),
          eq(artistResearchJobs.kind, "lore_refresh"),
          inArray(artistResearchJobs.status, ["pending", "running"]),
        ),
      });
      if (!job) return false;
    }
    signal?.throwIfAborted();
    await tx
      .insert(artistDocs)
      .values({ artistId, content, sources, loreSummary: loreSummary ?? null })
      .onConflictDoUpdate({
        target: [artistDocs.artistId],
        set: {
          content,
          sources,
          ...(loreSummary === undefined ? {} : { loreSummary }),
          updatedAt: sql`(now() AT TIME ZONE 'utc'::text)`,
        },
      });
    signal?.throwIfAborted();
    return true;
  });
}
