import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistClaims, artistDocs, artistResearchJobs } from "@/lib/db/schema";
import type { LoreSummary } from "@/lib/lore/types";

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
 * @returns True when written; false when ownership or the job changed.
 */
export async function persistRefreshedLore(
  artistId: string,
  content: string,
  sources: unknown[],
  expectedClaimId: string | null,
  jobId?: string,
  loreSummary?: LoreSummary | null,
): Promise<boolean> {
  return db.transaction(async tx => {
    await tx.execute(sql`select id from artists where id = ${artistId}::uuid for update`);
    const claim = await tx.query.artistClaims.findFirst({
      where: and(eq(artistClaims.artistId, artistId), eq(artistClaims.status, "approved")),
    });
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
    return true;
  });
}
