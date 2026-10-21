import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";

/**
 * Records that the one-time user-name prompt was shown, the first time only,
 * and only while the generated name still needs confirmation. Same SQL as
 * MusicNerdWeb's name-prompt route.
 *
 * @param userId - The caller's account.
 * @returns True when this call recorded it, so the prompt should show.
 */
export async function recordUserNamePrompt(userId: string): Promise<boolean> {
  const rows = rowsOf(
    await db.execute(sql`update users set username_prompted_at = now()
      where id = ${userId}::uuid and username_needs_confirmation = true and username_prompted_at is null returning id`),
  );
  return rows.length > 0;
}
