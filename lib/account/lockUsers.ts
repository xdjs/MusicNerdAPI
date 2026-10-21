import { asc, inArray } from "drizzle-orm";
import type { Transaction } from "@/lib/account/types";
import { users } from "@/lib/db/schema";

/**
 * Locks the account rows for the rest of the transaction, in a stable order.
 * The account merge takes these locks before reading either account.
 *
 * @param tx - The open transaction.
 * @param userIds - The accounts to lock.
 * @returns Nothing; throws when an account no longer exists.
 */
export async function lockUsers(tx: Transaction, userIds: string[]): Promise<void> {
  const ids = [...new Set(userIds)].sort();
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, ids))
    .orderBy(asc(users.id))
    .for("update");
  if (rows.length !== ids.length) throw new Error("Account no longer exists");
}
