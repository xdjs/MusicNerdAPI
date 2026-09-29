import type { ExtractedArtistId } from "@/lib/artists/types";
import { contradictsScrapedPosts } from "@/lib/identity/contradictsScrapedPosts";
import { handleBelongsToAnotherArtist } from "@/lib/identity/handleBelongsToAnotherArtist";
import { nameIsAmbiguousInDirectory } from "@/lib/identity/nameIsAmbiguousInDirectory";
import type { RelevanceVerdict } from "@/lib/relevance/types";
import type { SearchRun } from "@/lib/vault/types";
import { writeArtistLink } from "@/lib/vault/writeArtistLink";

/**
 * Writes an account the judge affirmed to the artist's links. This is the
 * weakest adoption path, so it never replaces a link the artist already has,
 * even a guessed one, and it runs the same identity checks as every other
 * path: a page about a DIFFERENT Black Dave is still about a Black Dave.
 *
 * @param run - The run; `run.artist` is updated by the write.
 * @param match - The account the URL points at.
 * @param url - The page's URL, for the log.
 * @param verdict - The judge's verdict on the page.
 * @returns True when the page was an affirmed account and is routed to links rather than the vault.
 */
export async function adoptJudgedAccount(
  run: SearchRun,
  match: ExtractedArtistId,
  url: string,
  verdict: RelevanceVerdict | undefined,
): Promise<boolean> {
  const alreadyHave = !!run.artist[match.siteName];
  if (alreadyHave) {
    console.log(
      `[vaultWebSearch] Already have ${match.siteName}; not replacing it with ${url.slice(0, 60)}`,
    );
  }
  const blocked =
    !alreadyHave &&
    ((await nameIsAmbiguousInDirectory(run.artistId, run.artistName)) ||
      (await handleBelongsToAnotherArtist(run.artistId, match.siteName, match.id)) ||
      (await contradictsScrapedPosts(run.artistId, match.siteName, match.id)));
  if (blocked) {
    console.log(
      `[vaultWebSearch] Not adopting ${match.siteName}=${match.id} — identity checks did not clear it`,
    );
  }
  if (alreadyHave || blocked || verdict !== "about-artist") return false;
  try {
    await writeArtistLink(run.artistId, match.siteName, match.id, undefined, run.artist);
    console.log(`[vaultWebSearch] ${match.siteName} profile -> links: ${url.slice(0, 80)}`);
  } catch (e) {
    console.warn(`[vaultWebSearch] Could not save discovered ${match.siteName} profile:`, e);
  }
  return true;
}
