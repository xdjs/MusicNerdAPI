import { asc, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";

/**
 * Users for the admin page: every user (MusicNerdWeb's `getAllUsers`), or
 * those whose wallet or username contains the search, case-insensitive, as
 * its admin search matched them.
 *
 * @param search - Part of a wallet address or username; omitted for every user.
 * @returns Each user's id, names, email, role flags and last update, by username then wallet.
 */
export async function searchUsers(search?: string) {
  const pattern = `%${search}%`;
  return db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      wallet: users.wallet,
      isAdmin: users.isAdmin,
      isWhiteListed: users.isWhiteListed,
      isHidden: users.isHidden,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(search ? or(ilike(users.wallet, pattern), ilike(users.username, pattern)) : undefined)
    .orderBy(asc(users.username), asc(users.wallet));
}
