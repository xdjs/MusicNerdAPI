import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";
import { needsUserName } from "@/lib/user/needsUserName";
import { validateUserName } from "@/lib/user/validateUserName";

/**
 * Sets a chosen user name inside the caller's transaction. Serialised with
 * MusicNerdWeb's name allocation by the same advisory lock; the unique index
 * still guards other writers.
 *
 * @param tx - The open transaction.
 * @param userId - The user to rename.
 * @param requestedName - The new name.
 * @returns Nothing. Throws with a user-facing message when the name is invalid or taken.
 */
export async function setRequestedUserName(
  tx: Pick<TransactionDb, "execute">,
  userId: string,
  requestedName: string,
): Promise<void> {
  const error = validateUserName(requestedName);
  if (error) throw new Error(error);
  const name = requestedName.trim();
  await tx.execute(sql`select pg_advisory_xact_lock(1387)`);
  const [user] = await tx.execute<{ wallet: string | null }>(
    sql`select wallet from users where id = ${userId}::uuid for update`,
  );
  if (!user) throw new Error("Account not found.");
  if (needsUserName({ username: name, wallet: user.wallet }))
    throw new Error("Choose a user name instead of an email or wallet address.");
  const taken = await tx.execute(sql`select id from users
    where id <> ${userId}::uuid and lower(btrim(username)) = lower(${name}) limit 1`);
  if (taken.length) throw new Error("That user name is already taken. Try another.");
  await tx.execute(sql`update users set username = ${name},
    username_needs_confirmation = false, updated_at = now() where id = ${userId}::uuid`);
}
