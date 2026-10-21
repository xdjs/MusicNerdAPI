import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistBioCorrections } from "@/lib/db/schema";

/**
 * Marks a pending About correction report resolved or dismissed, recording
 * the reviewer and the time. A report that isn't pending is left alone.
 *
 * @param reportId - The report.
 * @param status - The outcome.
 * @param reviewerId - The admin reviewing.
 * @returns True when the report was pending and is now reviewed; false otherwise.
 */
export async function reviewBioCorrection(
  reportId: string,
  status: "resolved" | "dismissed",
  reviewerId: string,
): Promise<boolean> {
  const [updated] = await db
    .update(artistBioCorrections)
    .set({ status, reviewedAt: new Date().toISOString(), reviewedBy: reviewerId })
    .where(and(eq(artistBioCorrections.id, reportId), eq(artistBioCorrections.status, "pending")))
    .returning({ id: artistBioCorrections.id });
  return !!updated;
}
