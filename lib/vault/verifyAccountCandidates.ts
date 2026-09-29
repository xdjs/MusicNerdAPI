import { getArtistById } from "@/lib/artists/getArtistById";
import { contradictsScrapedPosts } from "@/lib/identity/contradictsScrapedPosts";
import { handleBelongsToAnotherArtist } from "@/lib/identity/handleBelongsToAnotherArtist";
import { nameIsAmbiguousInDirectory } from "@/lib/identity/nameIsAmbiguousInDirectory";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { accountPageConfirms } from "@/lib/vault/accountPageConfirms";
import { MAX_ACCOUNT_CHECKS } from "@/lib/vault/const";
import { holdsAnswerFor } from "@/lib/vault/holdsAnswerFor";
import { rankAccountCandidates } from "@/lib/vault/rankAccountCandidates";
import type { SearchRun } from "@/lib/vault/types";
import { writeArtistLink } from "@/lib/vault/writeArtistLink";

/**
 * Verifies the account pages the search returned. These platforms serve a bot
 * no body, so the judge can't affirm them, but the page title names the
 * account holder. A shared name makes a title prove nothing, so the pass is
 * skipped then, and a handle another artist holds, or one their own posts
 * contradict, is left alone. An enrichment: a failure here keeps what the run
 * already found.
 *
 * @param run - The run; confirmed handles join `run.verifiedHandles`.
 * @returns Nothing.
 */
export async function verifyAccountCandidates(run: SearchRun): Promise<void> {
  if (run.accountCandidates.length === 0) return;
  try {
    if (await nameIsAmbiguousInDirectory(run.artistId, run.artistName)) {
      console.log(
        `[vaultWebSearch] Another artist's name here begins with "${run.artistName}" — nothing a page says can tell them apart, skipping ${run.accountCandidates.length} account candidate(s)`,
      );
      return;
    }
    const current = await getArtistById(run.artistId).catch(() => undefined);
    const done = new Set<string>();
    for (const cand of rankAccountCandidates(run.accountCandidates, run.artistName).slice(
      0,
      MAX_ACCOUNT_CHECKS,
    )) {
      if (done.has(cand.siteName)) continue;
      if (
        current &&
        holdsAnswerFor(current as Record<string, unknown>, cand.siteName, run.provisional)
      )
        continue;
      if (await handleBelongsToAnotherArtist(run.artistId, cand.siteName, cand.id)) {
        console.log(
          `[vaultWebSearch] ${cand.siteName}=${cand.id} is already another artist's, ignoring`,
        );
        continue;
      }
      if (await contradictsScrapedPosts(run.artistId, cand.siteName, cand.id)) {
        console.log(
          `[vaultWebSearch] ${cand.siteName}=${cand.id} contradicts the handle their own posts are authored by, ignoring`,
        );
        continue;
      }
      const identity = await accountPageConfirms(cand, run.artistName);
      if (!identity) continue;
      try {
        await writeArtistLink(
          run.artistId,
          cand.siteName,
          cand.id,
          run.provisional,
          current as Record<string, unknown> | undefined,
        );
        console.log(
          `[vaultWebSearch] Search found ${cand.siteName}=${cand.id}, page confirms it: "${identity.slice(0, 60)}"`,
        );
        done.add(cand.siteName);
        run.verifiedHandles.add(normalizeHandle(cand.id));
      } catch (e) {
        console.warn(`[vaultWebSearch] Could not save ${cand.siteName} from search:`, e);
      }
    }
  } catch (e) {
    console.error("[vaultWebSearch] Account verification pass failed:", e);
  }
}
