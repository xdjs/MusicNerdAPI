import { and, eq, gte, sql } from "drizzle-orm";
import { BIO_CORRECTION_REPORT_LIMIT } from "@/lib/bioCorrections/const";
import type { BioCorrectionInput } from "@/lib/bioCorrections/types";
import { db } from "@/lib/db/db";
import { artistBioCorrections } from "@/lib/db/schema";

/**
 * Files a report on an artist's About. Submissions are serialized per account
 * with an advisory lock, so concurrent requests can't get past the daily limit.
 * The same pending report again is a duplicate, not a new row.
 *
 * @param userId - The reporting account.
 * @param artistId - The artist.
 * @param input - The validated report.
 * @param bioSnapshot - The About as it is now, which the report is about.
 * @returns "created", "duplicate", or "limited" when the account has filed BIO_CORRECTION_REPORT_LIMIT in 24 hours.
 */
export async function submitBioCorrection(
  userId: string,
  artistId: string,
  input: BioCorrectionInput,
  bioSnapshot: string,
): Promise<"created" | "duplicate" | "limited"> {
  return db.transaction(async tx => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`bio-correction:${userId}`}, 0))`,
    );
    const [duplicate] = await tx
      .select({ id: artistBioCorrections.id })
      .from(artistBioCorrections)
      .where(
        and(
          eq(artistBioCorrections.userId, userId),
          eq(artistBioCorrections.artistId, artistId),
          eq(artistBioCorrections.bioSnapshot, bioSnapshot),
          eq(artistBioCorrections.status, "pending"),
          eq(artistBioCorrections.reason, input.reason),
          eq(artistBioCorrections.details, input.details),
          sql`${artistBioCorrections.sourceUrl} is not distinct from ${input.sourceUrl}`,
        ),
      )
      .limit(1);
    if (duplicate) return "duplicate";
    const recent = await tx
      .select({ id: artistBioCorrections.id })
      .from(artistBioCorrections)
      .where(
        and(
          eq(artistBioCorrections.userId, userId),
          gte(artistBioCorrections.createdAt, new Date(Date.now() - 86400000).toISOString()),
        ),
      )
      .limit(BIO_CORRECTION_REPORT_LIMIT);
    if (recent.length >= BIO_CORRECTION_REPORT_LIMIT) return "limited";
    await tx.insert(artistBioCorrections).values({
      artistId,
      userId,
      reason: input.reason,
      details: input.details,
      sourceUrl: input.sourceUrl,
      bioSnapshot,
    });
    return "created";
  });
}
