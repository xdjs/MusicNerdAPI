import { claimApprovedEmailHtml } from "@/lib/email/claimApprovedEmailHtml";
import { sendEmail } from "@/lib/email/sendEmail";

/**
 * Tells a claimant their claim is approved.
 *
 * @param to - The claimant's email.
 * @param artistName - The artist, or null when it couldn't be read.
 * @param artistId - The artist.
 * @returns True when the email was accepted; never throws.
 */
export async function sendClaimApprovedEmail(
  to: string,
  artistName: string | null,
  artistId: string,
): Promise<boolean> {
  return sendEmail({
    to,
    subject: artistName
      ? `Your ${artistName.replace(/[\r\n]+/g, " ")} profile on Music Nerd is approved 🎉`
      : `Your Music Nerd profile is approved 🎉`,
    html: claimApprovedEmailHtml(artistName, artistId),
  });
}
