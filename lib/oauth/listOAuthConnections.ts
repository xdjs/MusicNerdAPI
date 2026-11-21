import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { oauthClients, oauthGrants } from "@/lib/db/schema";
import { MCP_SCOPE } from "@/lib/oauth/const";
import type { OAuthConnection } from "@/lib/oauth/types";

const iso = (timestamp: string) => new Date(timestamp).toISOString();

/**
 * The agents a user has connected, newest first.
 *
 * @param userId - The signed-in user.
 * @returns Their connections, and no one else's.
 */
export async function listOAuthConnections(userId: string): Promise<OAuthConnection[]> {
  const rows = await db
    .select({
      id: oauthGrants.id,
      agent: oauthClients.name,
      connectedAt: oauthGrants.createdAt,
      lastUsedAt: oauthGrants.lastUsedAt,
    })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
    .where(eq(oauthGrants.userId, userId))
    .orderBy(desc(oauthGrants.createdAt));
  return rows.map(row => ({
    id: row.id,
    agent: row.agent,
    scopes: [MCP_SCOPE],
    connectedAt: iso(row.connectedAt),
    lastUsedAt: row.lastUsedAt ? iso(row.lastUsedAt) : null,
  }));
}
