import { randomInt } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { USER_NAME_FIRST, USER_NAME_SECOND } from "@/lib/users/const";
import { needsUserName } from "@/lib/users/needsUserName";
import { validateUserName } from "@/lib/users/validateUserName";

type UserNameRow = {
  username: string | null;
  wallet: string | null;
  usernameNeedsConfirmation: boolean;
};

/**
 * Sets a user's name: the requested one, or a generated one when the account
 * has none (or an email or wallet as its name) and no name is requested.
 * Names are reserved case-insensitively and trimmed under an advisory lock,
 * so two writers cannot take the same one; the unique index backs this up.
 * Ported from MusicNerdWeb's `setUserName`. Callers authorize the account.
 *
 * @param userId - The account.
 * @param requestedName - The chosen name; omit to assign only when needed.
 * @param connection - The database, or an open transaction to run inside.
 * @returns The saved name and whether it still needs confirmation; throws a
 * message for an invalid or taken name, an unknown account, or a database error.
 */
export async function setUserName(
  userId: string,
  requestedName?: string,
  connection: Pick<typeof db, "transaction"> = db,
): Promise<{ username: string; usernameNeedsConfirmation: boolean }> {
  if (requestedName !== undefined) {
    const error = validateUserName(requestedName);
    if (error) throw new Error(error);
  }
  return connection.transaction(async tx => {
    // Shared by automatic allocation and chosen-name edits; the unique index
    // also protects against other writers. Never rely on a browser availability check.
    await tx.execute(sql`select pg_advisory_xact_lock(1387)`);
    const rows = rowsOf(
      await tx.execute(sql`select username, wallet, username_needs_confirmation as "usernameNeedsConfirmation"
      from users where id = ${userId}::uuid for update`),
    );
    const user = rows[0] as UserNameRow | undefined;
    if (!user) throw new Error("Account not found.");
    if (
      requestedName !== undefined &&
      needsUserName({ username: requestedName, wallet: user.wallet })
    )
      throw new Error("Choose a user name instead of an email or wallet address.");
    if (requestedName === undefined && !needsUserName(user)) {
      return {
        username: user.username!,
        usernameNeedsConfirmation: user.usernameNeedsConfirmation,
      };
    }
    for (let attempt = 0; attempt < 100; attempt++) {
      const suffix = attempt >= 32 ? String(randomInt(1000, 1000000)) : "";
      const name =
        requestedName?.trim() ??
        `${USER_NAME_FIRST[randomInt(USER_NAME_FIRST.length)]} ${USER_NAME_SECOND[randomInt(USER_NAME_SECOND.length)]}${suffix}`;
      const taken = rowsOf(
        await tx.execute(
          sql`select id from users where id <> ${userId}::uuid and lower(btrim(username)) = lower(${name}) limit 1`,
        ),
      );
      if (taken.length) {
        if (requestedName !== undefined)
          throw new Error("That user name is already taken. Try another.");
        continue;
      }
      const updated = rowsOf(
        await tx.execute(sql`update users set username = ${name},
        username_needs_confirmation = ${requestedName === undefined}, updated_at = now()
        where id = ${userId}::uuid
        returning username, username_needs_confirmation as "usernameNeedsConfirmation"`),
      );
      return updated[0] as { username: string; usernameNeedsConfirmation: boolean };
    }
    throw new Error("Could not assign a user name. Please try again.");
  });
}
