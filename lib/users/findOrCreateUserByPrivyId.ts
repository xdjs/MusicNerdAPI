import { eq } from "drizzle-orm";
import { getPrivyUser } from "@/lib/auth/getPrivyUser";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";

const findUser = (privyUserId: string) =>
  db.query.users.findFirst({ where: eq(users.privyUserId, privyUserId) });

/**
 * The Music Nerd user for a verified Privy account, created on first sight
 * with the Privy email and no name or roles, as MusicNerdWeb's sign-in did.
 * Two first calls at once insert one row: the second insert does nothing and
 * both read the same row.
 *
 * @param privyUserId - The Privy user id from a verified token.
 * @returns The user's whole row; throws on a database error.
 */
export async function findOrCreateUserByPrivyId(privyUserId: string) {
  const existing = await findUser(privyUserId);
  if (existing) return existing;
  const privyUser = await getPrivyUser(privyUserId);
  await db
    .insert(users)
    .values({ privyUserId, email: privyUser?.email?.address ?? null, username: null })
    .onConflictDoNothing();
  const created = await findUser(privyUserId);
  if (!created) throw new Error("Could not create the user");
  return created;
}
