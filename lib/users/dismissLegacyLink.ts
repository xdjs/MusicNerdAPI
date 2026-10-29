import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";

/**
 * Records that the user dismissed the prompt to link an older wallet-based
 * account. Ported from MusicNerdWeb's `dismissLegacyLink` query.
 *
 * @param userId - The caller's account.
 * @returns Nothing; throws when there is no such user or the database fails.
 */
export async function dismissLegacyLink(userId: string): Promise<void> {
  const updated = await db
    .update(users)
    .set({ legacyLinkDismissed: true, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (!updated.length) throw new Error("User not found");
}
