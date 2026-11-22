import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { USED_REFRESH_TOKEN_RETENTION_DAYS } from "@/lib/oauth/const";

/**
 * Deletes the tokens nothing can use or check any more: expired codes and
 * access tokens, and used refresh tokens past the replay window. A used
 * refresh token stays while it was used within
 * `USED_REFRESH_TOKEN_RETENTION_DAYS`, or while it is the last one used on its
 * grant, so replaying it still disconnects the agent.
 *
 * @returns How many tokens were deleted.
 */
export async function pruneOAuthTokens(): Promise<number> {
  const rows = rowsOf(
    await db.execute(sql`
      delete from oauth_tokens t
      where (t.kind <> 'refresh' and t.expires_at <= now())
        or (
          t.kind = 'refresh'
          and t.used_at < now() - make_interval(days => ${USED_REFRESH_TOKEN_RETENTION_DAYS})
          and exists (
            select 1 from oauth_tokens n
            where n.grant_id = t.grant_id and n.kind = 'refresh' and n.used_at > t.used_at
          )
        )
      returning t.hash
    `),
  );
  return rows.length;
}
