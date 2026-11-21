import { asc, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";

/**
 * Users whose wallet or username contains the search, case-insensitive, as
 * MusicNerdWeb's admin search matched them.
 *
 * @param search - Part of a wallet address or username.
 * @returns Each match's id, username and wallet, by username then wallet.
 */
export async function searchUsers(
  search: string,
): Promise<{ id: string; username: string | null; wallet: string | null }[]> {
  const pattern = `%${search}%`;
  return db
    .select({ id: users.id, username: users.username, wallet: users.wallet })
    .from(users)
    .where(or(ilike(users.wallet, pattern), ilike(users.username, pattern)))
    .orderBy(asc(users.username), asc(users.wallet));
}
