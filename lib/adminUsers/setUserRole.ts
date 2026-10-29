import { inArray } from "drizzle-orm";
import type { UserRole } from "@/lib/adminUsers/types";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";

const columns = { whitelisted: "isWhiteListed", admin: "isAdmin", hidden: "isHidden" } as const;

/**
 * Turns a role on or off for the given users. Granting admin also whitelists
 * the user, as MusicNerdWeb's admin did; removing it leaves the whitelist.
 *
 * @param userIds - The users.
 * @param role - The role.
 * @param enabled - Whether to grant it.
 * @returns How many users were updated.
 */
export async function setUserRole(
  userIds: string[],
  role: UserRole,
  enabled: boolean,
): Promise<number> {
  const updated = await db
    .update(users)
    .set({
      [columns[role]]: enabled,
      ...(role === "admin" && enabled ? { isWhiteListed: true } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(inArray(users.id, userIds))
    .returning({ id: users.id });
  return updated.length;
}
