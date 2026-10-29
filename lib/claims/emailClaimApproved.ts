import { getArtistById } from "@/lib/artists/getArtistById";
import { sendClaimApprovedEmail } from "@/lib/email/sendClaimApprovedEmail";
import { getUserById } from "@/lib/users/getUserById";

/**
 * Emails the claimant that their claim is approved. Skips a claimant with no
 * email (wallet-only accounts), and never throws: the approval has committed.
 *
 * @param claim - The approved claim.
 * @param claim.userId - The claimant.
 * @param claim.artistId - The artist.
 * @returns Once sent, skipped or the failure logged.
 */
export async function emailClaimApproved(claim: {
  userId: string;
  artistId: string;
}): Promise<void> {
  try {
    const [user, artist] = await Promise.all([
      getUserById(claim.userId),
      getArtistById(claim.artistId),
    ]);
    if (!user?.email) {
      console.log(`[claims] No email for user ${claim.userId}; skipping approval email`);
      return;
    }
    await sendClaimApprovedEmail(user.email, artist?.name ?? null, claim.artistId);
  } catch (e) {
    console.error("[claims] Approval email failed:", e);
  }
}
