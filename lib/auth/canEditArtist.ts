import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { users } from "@/lib/db/schema";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";

/**
 * May this user edit this artist? The approved claimant, or an admin. An
 * artist has at most one approved claim, so comparing its user is the same
 * check as MusicNerdWeb's claim-by-user query.
 *
 * @param userId - The Music Nerd user.
 * @param artistId - The artist.
 * @returns True for the claimant or an admin.
 */
export async function canEditArtist(userId: string, artistId: string): Promise<boolean> {
  const claim = await findApprovedClaim(db, artistId);
  if (claim?.userId === userId) return true;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isAdmin: true },
  });
  return !!user?.isAdmin;
}
