import { db } from "@/lib/db/db";
import { oauthGrants } from "@/lib/db/schema";

/**
 * Connects a client to a user: the grant every token for this connection hangs off.
 *
 * @param clientId - The approved client.
 * @param userId - The member who approved it.
 * @returns The grant's id, which is the connection's id.
 */
export async function createOAuthGrant(clientId: string, userId: string): Promise<string> {
  const [row] = await db
    .insert(oauthGrants)
    .values({ clientId, userId })
    .returning({ id: oauthGrants.id });
  return row.id;
}
