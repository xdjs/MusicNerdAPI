import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { hashToken } from "@/lib/oauth/hashToken";

type Row = {
  grant_id: string;
  user_id: string;
  is_admin: boolean;
  email: string | null;
  agent: string;
};

/**
 * The connection, user and agent behind an access token, in one query. Checked
 * against the database on every call, so a disconnect takes effect at once.
 *
 * @param token - The raw access token.
 * @returns The grant, user, admin flag, email and the agent's registered name, or undefined when the token is unknown, expired or revoked.
 */
export async function findGrantByAccessToken(token: string) {
  const [row] = rowsOf(
    await db.execute(sql`
      select g.id as grant_id, u.id as user_id, u.is_admin, u.email, c.name as agent
      from oauth_tokens t
      join oauth_grants g on g.id = t.grant_id
      join users u on u.id = g.user_id
      join oauth_clients c on c.id = g.client_id
      where t.hash = ${hashToken(token)} and t.kind = 'access' and t.expires_at > now()
    `),
  ) as Row[];
  if (!row) return undefined;
  return {
    grantId: row.grant_id,
    userId: row.user_id,
    isAdmin: row.is_admin,
    email: row.email,
    agent: row.agent,
  };
}
