import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { setRequestedUserName } from "@/lib/whitelistUser/setRequestedUserName";
import type { WhitelistUserBody } from "@/lib/whitelistUser/validateWhitelistUserBody";

/**
 * Applies an admin's edits to a user in one transaction. Making someone an
 * admin also whitelists them, and then `isWhiteListed` is ignored.
 *
 * @param userId - The user to edit.
 * @param data - The fields to change; absent fields are left alone.
 * @returns `success` with a message, or `error` when nothing was given to change. Throws on a bad name or database error.
 */
export async function updateWhitelistedUser(
  userId: string,
  data: WhitelistUserBody,
): Promise<{ status: "success" | "error"; message: string }> {
  return db.transaction(async tx => {
    const sets: SQL[] = [];
    if (data.wallet !== undefined) sets.push(sql`wallet = ${data.wallet}`);
    if (data.email !== undefined) sets.push(sql`email = ${data.email}`);
    if (data.username !== undefined) await setRequestedUserName(tx, userId, data.username);
    if (data.isAdmin !== undefined) {
      sets.push(sql`is_admin = ${data.isAdmin}`);
      if (data.isAdmin) sets.push(sql`is_white_listed = true`);
    }
    if (data.isWhiteListed !== undefined && data.isAdmin !== true)
      sets.push(sql`is_white_listed = ${data.isWhiteListed}`);
    if (data.isHidden !== undefined) sets.push(sql`is_hidden = ${data.isHidden}`);
    if (!sets.length)
      return data.username !== undefined
        ? { status: "success", message: "User updated successfully" }
        : { status: "error", message: "No fields to update" };
    await tx.execute(sql`update users set ${sql.join(sets, sql`, `)} where id = ${userId}::uuid`);
    return { status: "success", message: "User updated successfully" };
  });
}
