import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistClaims } from "@/lib/db/schema";

/**
 * The user's approved artist claim, for GET /api/user/has-claim.
 *
 * @param userId - The user.
 * @returns The claim, or undefined when there is none or the database failed.
 */
export async function getApprovedClaimByUserId(userId: string) {
  try {
    return await db.query.artistClaims.findFirst({
      where: and(eq(artistClaims.userId, userId), eq(artistClaims.status, "approved")),
    });
  } catch (e) {
    console.error("[getApprovedClaimByUserId] Error:", e);
    return undefined;
  }
}
