import { clearArtistLink } from "@/lib/artistLinks/clearArtistLink";
import { setArtistLink } from "@/lib/artistLinks/setArtistLink";
import { extractArtistId } from "@/lib/artists/extractArtistId";
import { linkIsIdentityBlocked } from "@/lib/onboarding/linkIsIdentityBlocked";
import { routeLinkToVault } from "@/lib/onboarding/routeLinkToVault";
import type { LinkDecisionRun, ProfileLinkOutcome } from "@/lib/onboarding/types";
import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import { normalizePublicUrl } from "@/lib/sources/normalizePublicUrl";

/**
 * Saves the artist's decisions from the profiles card: clear what they
 * removed, write what they kept or pasted, route a non-profile URL to the
 * vault. Shared by confirm_profiles, find_more_profiles and the auto-build;
 * never advances the step. Idempotent, so a resubmitted turn doesn't double-act.
 *
 * @param artistId - The artist.
 * @param addedLinks - Links to add.
 * @param removedSiteNames - Link columns to clear.
 * @param opts - Options.
 * @param opts.verifyIdentity - Check each handle is this artist's before writing. Only the auto-build, which writes discovery's guesses, turns it on: an artist adding their own link must not be blocked.
 * @returns What happened to each link, bucketed for the chat copy.
 */
export async function applyProfileLinkDecisions(
  artistId: string,
  addedLinks: { url: string }[],
  removedSiteNames: string[],
  opts?: { verifyIdentity?: boolean },
): Promise<ProfileLinkOutcome> {
  for (const siteName of removedSiteNames) {
    try {
      await clearArtistLink(artistId, siteName);
    } catch (e) {
      console.error(`[onboarding] clearArtistLink failed for ${siteName}:`, e);
    }
  }
  const outcome: ProfileLinkOutcome = {
    written: [],
    identityBlocked: [],
    unrecognized: [],
    writeRejected: [],
    routedToVaultApproved: [],
    routedToVaultPending: [],
    vaultInsertFailed: [],
  };
  const run: LinkDecisionRun = { artistId };
  for (const entry of addedLinks) {
    const url = normalizePublicUrl(entry.url);
    if (!url || isUnsafeUrl(url)) {
      outcome.unrecognized.push(entry.url);
      continue;
    }
    let extracted;
    try {
      extracted = await extractArtistId(url);
    } catch (e) {
      console.error(`[onboarding] extractArtistId failed for ${url}:`, e);
      outcome.unrecognized.push(url);
      continue;
    }
    if (!extracted?.siteName || !extracted?.id) {
      outcome[await routeLinkToVault(run, url)].push(url);
      continue;
    }
    if (
      opts?.verifyIdentity &&
      (await linkIsIdentityBlocked(run, extracted.siteName, String(extracted.id)))
    ) {
      outcome.identityBlocked.push(url);
      continue;
    }
    try {
      await setArtistLink(artistId, extracted.siteName, extracted.id);
      outcome.written.push(extracted.siteName);
    } catch (e) {
      console.error(`[onboarding] setArtistLink failed for ${url}:`, e);
      outcome.writeRejected.push(url);
    }
  }
  return outcome;
}
