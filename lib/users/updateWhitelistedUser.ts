import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";
import { setUserName } from "@/lib/users/setUserName";

/** The fields an admin may change on a user. `null` clears `wallet` or `email`. */
export type WhitelistedUserUpdate = {
  wallet?: string | null;
  email?: string | null;
  username?: string;
  isAdmin?: boolean;
  isWhiteListed?: boolean;
  isHidden?: boolean;
};

/**
 * Updates a user's editable fields (wallet, email, user name, roles) in one
 * transaction, as MusicNerdWeb's `updateWhitelistedUser` does: an admin is
 * also whitelisted, and a refused user name fails the whole update.
 *
 * @param userId - The user.
 * @param data - The fields to change; fields left undefined are untouched.
 * @returns `{ status: "success" }` with a message, or `{ status: "error" }` with MusicNerdWeb's message.
 */
export async function updateWhitelistedUser(
  userId: string,
  data: WhitelistedUserUpdate,
): Promise<{ status: "success" | "error"; message: string }> {
  try {
    if (!userId) throw new Error("Invalid user id");
    return await db.transaction(async tx => {
      const updateData: Record<string, string | boolean | null> = {};
      if (data.wallet !== undefined) updateData.wallet = data.wallet;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.username !== undefined) await setUserName(userId, data.username, tx);

      // Handle role flag changes
      if (data.isAdmin !== undefined) {
        updateData.isAdmin = data.isAdmin;
        // Auto-whitelist admins
        if (data.isAdmin) {
          updateData.isWhiteListed = true;
        }
      }

      if (data.isWhiteListed !== undefined && data.isAdmin !== true) {
        // Only update whitelist if not overridden by admin logic above
        updateData.isWhiteListed = data.isWhiteListed;
      }

      // Handle hidden role flag
      if (data.isHidden !== undefined) {
        updateData.isHidden = data.isHidden;
      }

      if (Object.keys(updateData).length === 0) {
        return data.username !== undefined
          ? { status: "success" as const, message: "User updated successfully" }
          : { status: "error" as const, message: "No fields to update" };
      }

      await tx.update(users).set(updateData).where(eq(users.id, userId));
      return { status: "success" as const, message: "User updated successfully" };
    });
  } catch (e) {
    console.error("error updating whitelisted user", e);
    return { status: "error", message: "Error updating user" };
  }
}
