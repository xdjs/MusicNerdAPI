import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistClaims } from "@/lib/db/schema";

/**
 * Approves or rejects a claim, whatever its current status, as MusicNerdWeb did.
 *
 * @param claimId - The claim.
 * @param status - The new status.
 * @returns The updated claim, or undefined when there is none; throws on a database error.
 */
export async function setClaimStatus(claimId: string, status: "approved" | "rejected") {
  const [updated] = await db
    .update(artistClaims)
    .set({ status, updatedAt: sql`(now() AT TIME ZONE 'utc'::text)` })
    .where(eq(artistClaims.id, claimId))
    .returning();
  return updated;
}
