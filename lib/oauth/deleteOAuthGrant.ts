import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { oauthGrants } from "@/lib/db/schema";
import { UUID } from "@/lib/oauth/const";

/**
 * Disconnects one of a user's agents: deleting the grant deletes its tokens.
 * Another user's grant, a missing one or a malformed id changes nothing.
 *
 * @param grantId - The connection's id.
 * @param userId - The signed-in user.
 */
export async function deleteOAuthGrant(grantId: string, userId: string): Promise<void> {
  if (!UUID.test(grantId)) return;
  await db
    .delete(oauthGrants)
    .where(and(eq(oauthGrants.id, grantId), eq(oauthGrants.userId, userId)));
}
