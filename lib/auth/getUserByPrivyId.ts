import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";

/**
 * The Music Nerd user for a Privy account. Users are created when they first
 * sign in to MusicNerdWeb, so an unknown Privy id has no user here.
 *
 * @param privyUserId - The Privy user id from a verified token.
 * @returns The user's id and admin flag, or undefined. A database error throws.
 */
export async function getUserByPrivyId(
  privyUserId: string,
): Promise<{ id: string; isAdmin: boolean } | undefined> {
  return db.query.users.findFirst({
    where: eq(users.privyUserId, privyUserId),
    columns: { id: true, isAdmin: true },
  });
}
