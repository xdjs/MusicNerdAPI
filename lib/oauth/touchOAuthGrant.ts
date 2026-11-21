import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { oauthGrants } from "@/lib/db/schema";

/**
 * Records that a connection was just used.
 *
 * @param grantId - The grant.
 */
export async function touchOAuthGrant(grantId: string): Promise<void> {
  await db
    .update(oauthGrants)
    .set({ lastUsedAt: sql`now()` })
    .where(eq(oauthGrants.id, grantId));
}
