import { eq, sql } from "drizzle-orm";
import { lockUsers } from "@/lib/account/lockUsers";
import { needsUserName } from "@/lib/users/needsUserName";
import { transferBioCorrections } from "@/lib/account/transferBioCorrections";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";

/**
 * Merges the signed-in placeholder account into the legacy wallet account, in
 * one transaction: the legacy account takes the Privy identity, the merged
 * name and counts, the artists added, the UGC, the self-edits, the activity
 * ledger and the bio corrections; the placeholder is deleted.
 * Any failure rolls everything back.
 *
 * @param currentUserId - The signed-in placeholder account.
 * @param legacyUserId - The legacy account that owns the wallet.
 * @returns `{ success: true }`, or `{ success: false, error }`.
 */
export async function mergeAccounts(
  currentUserId: string,
  legacyUserId: string,
): Promise<{ success: boolean; error?: string }> {
  if (currentUserId === legacyUserId)
    return { success: false, error: "Cannot merge the same account" };
  try {
    const now = new Date().toISOString();

    // Perform all operations in a single transaction to prevent TOCTOU race conditions
    const result = await db.transaction(async tx => {
      // Match the name reservation lock order before taking account row locks.
      await tx.execute(sql`select pg_advisory_xact_lock(1387)`);
      // Lock both accounts in stable order before reading or changing either.
      await lockUsers(tx, [currentUserId, legacyUserId]);
      // Get both users inside transaction to ensure consistency
      const currentUser = await tx.query.users.findFirst({ where: eq(users.id, currentUserId) });
      const legacyUser = await tx.query.users.findFirst({ where: eq(users.id, legacyUserId) });

      if (!currentUser || !legacyUser) {
        return { success: false as const, error: "User not found" };
      }

      if (!currentUser.privyUserId) {
        return { success: false as const, error: "Current user has no Privy ID" };
      }

      if (legacyUser.privyUserId && legacyUser.privyUserId !== currentUser.privyUserId) {
        return {
          success: false as const,
          error: "Legacy account is already linked to another user",
        };
      }

      // A name explicitly chosen in the new welcome flow wins over the
      // restored account's old name. Unconfirmed generated names do not.
      const keepCurrentName =
        currentUser.usernameNeedsConfirmation === false && !needsUserName(currentUser);
      const nameUpdate = keepCurrentName
        ? {
            username: currentUser.username,
            usernameNeedsConfirmation: false,
            usernamePromptedAt: currentUser.usernamePromptedAt,
          }
        : { usernamePromptedAt: legacyUser.usernamePromptedAt ?? currentUser.usernamePromptedAt };

      // Release unique identifiers inside this same transaction before
      // moving them to the surviving legacy account. Other allocators wait
      // on the name lock; any failure rolls the release back too.
      await tx
        .update(users)
        .set({ privyUserId: null, ...(keepCurrentName ? { username: null } : {}) })
        .where(eq(users.id, currentUserId));

      // Update legacy user with Privy ID and merged data
      await tx
        .update(users)
        .set({
          ...nameUpdate,
          privyUserId: currentUser.privyUserId,
          email: currentUser.email || legacyUser.email,
          acceptedUgcCount:
            (legacyUser.acceptedUgcCount || 0) + (currentUser.acceptedUgcCount || 0),
          updatedAt: now,
        })
        .where(eq(users.id, legacyUserId));

      // Update foreign keys: artists.addedBy
      await tx.execute(sql`
                UPDATE artists
                SET added_by = ${legacyUserId}
                WHERE added_by = ${currentUserId}
            `);

      // Update foreign keys: ugcresearch.userId
      await tx.execute(sql`
                UPDATE ugcresearch
                SET user_id = ${legacyUserId}
                WHERE user_id = ${currentUserId}
            `);

      // Preserve self-edit history before deleting its former owner.
      await tx.execute(sql`
                UPDATE artist_self_edits
                SET user_id = ${legacyUserId}
                WHERE user_id = ${currentUserId}
            `);

      // The activity ledger stays append-only to mnweb. This narrow audited
      // identity transfer runs after Privy moves, inside the same transaction.
      // If it fails (including a missing migration), do not delete the actor.
      await tx.execute(sql`
                SELECT public.transfer_account_activity(
                    ${currentUserId}::uuid, ${legacyUserId}::uuid, ${currentUser.privyUserId}
                )
            `);

      await transferBioCorrections(tx, currentUserId, legacyUserId);

      // Delete the current (placeholder) user.
      await tx.delete(users).where(eq(users.id, currentUserId));

      return { success: true as const };
    });

    return result;
  } catch (error) {
    console.error("[Merge] Account merge failed:", error);
    return { success: false, error: "Merge failed" };
  }
}
