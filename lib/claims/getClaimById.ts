import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistClaims } from "@/lib/db/schema";

/**
 * One claim, whatever its status.
 *
 * @param claimId - The claim.
 * @returns The claim, or undefined when there is none; throws on a database error.
 */
export async function getClaimById(claimId: string) {
  return db.query.artistClaims.findFirst({ where: eq(artistClaims.id, claimId) });
}
