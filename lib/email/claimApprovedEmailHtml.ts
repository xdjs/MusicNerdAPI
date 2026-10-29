import { MUSICNERD_WEB_URL } from "@/lib/const";
import { escapeHtml } from "@/lib/email/escapeHtml";

/**
 * The body of the email a claimant gets when their claim is approved.
 *
 * @param artistName - The artist, or null when it couldn't be read.
 * @param artistId - The artist, for the link to their page.
 * @returns The HTML.
 */
export function claimApprovedEmailHtml(artistName: string | null, artistId: string): string {
  const url = `${MUSICNERD_WEB_URL}/artist/${artistId}`;
  const manageLine = artistName
    ? `You now manage <strong>${escapeHtml(artistName)}</strong> on Music Nerd.`
    : `You now manage your artist profile on Music Nerd.`;
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #111;">
  <h1 style="font-size: 22px; margin: 0 0 12px;">Your profile is approved 🎉</h1>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
    ${manageLine} Take two minutes to finish
    setting up — confirm your links, tell us your story, and publish your About page.
  </p>
  <a href="${url}" style="display: inline-block; background: #ff4b84; color: #fff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 10px; font-size: 15px;">
    Finish setting up your profile
  </a>
  <p style="font-size: 12px; color: #888; margin: 24px 0 0;">
    What you add helps Music Nerd tell your story to fans.
  </p>
</div>`;
}
