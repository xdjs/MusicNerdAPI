import { contradictsScrapedPosts } from "@/lib/identity/contradictsScrapedPosts";
import { handleBelongsToAnotherArtist } from "@/lib/identity/handleBelongsToAnotherArtist";
import { nameIsAmbiguousInDirectory } from "@/lib/identity/nameIsAmbiguousInDirectory";
import { artistNameForRun } from "@/lib/onboarding/artistNameForRun";
import type { LinkDecisionRun } from "@/lib/onboarding/types";

/**
 * The same identity checks the source search applies, for a handle discovery
 * guessed and nobody has looked at. With three Black Daves in the directory,
 * writing guesses unchecked gave one another's Instagram.
 *
 * @param run - The link-decision run.
 * @param siteName - The platform.
 * @param id - The handle or id.
 * @returns True when the handle can't be shown to be this artist's.
 */
export async function linkIsIdentityBlocked(
  run: LinkDecisionRun,
  siteName: string,
  id: string,
): Promise<boolean> {
  const blocked =
    (await nameIsAmbiguousInDirectory(run.artistId, await artistNameForRun(run))) ||
    (await handleBelongsToAnotherArtist(run.artistId, siteName, id)) ||
    (await contradictsScrapedPosts(run.artistId, siteName, id));
  if (blocked) {
    console.log(`[onboarding] Not writing ${siteName}=${id} — identity checks did not clear it`);
  }
  return blocked;
}
