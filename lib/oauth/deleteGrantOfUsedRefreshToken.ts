import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { hashToken } from "@/lib/oauth/hashToken";

/**
 * Replay protection: a refresh token that was already used means it leaked,
 * so its grant is deleted, and every token under it with it.
 *
 * @param token - The raw refresh token that was presented.
 * @returns True when a grant was deleted.
 */
export async function deleteGrantOfUsedRefreshToken(token: string): Promise<boolean> {
  const rows = rowsOf(
    await db.execute(sql`
      delete from oauth_grants where id in (
        select grant_id from oauth_tokens
        where hash = ${hashToken(token)} and kind = 'refresh' and used_at is not null
      )
      returning id
    `),
  );
  return rows.length > 0;
}
