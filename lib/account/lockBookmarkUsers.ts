import { asc, inArray } from "drizzle-orm";
import type { Transaction } from "@/lib/account/types";
import { users } from "@/lib/db/schema";

/**
 * Locks the account rows for the rest of the transaction, in a stable order.
 * The account row is stable even when there are zero bookmarks. All writes,
 * including legacy account merges, take these locks before reading bookmark state.
 *
 * @param tx - The open transaction.
 * @param userIds - The accounts to lock.
 * @returns Nothing; throws when an account no longer exists.
 */
export async function lockBookmarkUsers(tx: Transaction, userIds: string[]): Promise<void> {
  const ids = [...new Set(userIds)].sort();
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, ids))
    .orderBy(asc(users.id))
    .for("update");
  if (rows.length !== ids.length) throw new Error("Bookmark account no longer exists");
}
