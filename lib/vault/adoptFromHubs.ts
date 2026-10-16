import { getArtistById } from "@/lib/artists/getArtistById";
import { adoptHandlesFromOwnPage } from "@/lib/vault/adoptHandlesFromOwnPage";
import { MAX_HUB_PAGES } from "@/lib/vault/const";
import { outOfBudget } from "@/lib/vault/outOfBudget";
import type { SearchRun } from "@/lib/vault/types";

/**
 * Works out which of the pages we read are the artist's own, once the run has
 * learned what it can. It re-reads the artist first: an account adopted during
 * the loop can establish authority for that account's own page. Merely linking
 * an artist account does not make a review or publisher page theirs. Each distinct
 * referring page/link set is examined once, at most `MAX_HUB_PAGES`, and the
 * record is refreshed after each adoption to recognize newly saved accounts.
 *
 * @param run - The run; handles proven on a hub join `run.verifiedHandles`.
 * @returns Nothing. Throws only for a durable run out of time.
 */
export async function adoptFromHubs(run: SearchRun): Promise<void> {
  if (run.hubCandidates.length === 0) return;
  const current = await getArtistById(run.artistId).catch(e => {
    console.error("[vaultWebSearch] Could not re-read artist for hub adoption:", e);
    return undefined;
  });
  if (!current) return;
  const seen = new Set<string>();
  for (const hub of run.hubCandidates.slice(0, MAX_HUB_PAGES)) {
    // The same outbound links on different pages do not share ownership authority.
    const key = JSON.stringify([hub.url, hub.aboutArtist, [...hub.links].sort()]);
    if (seen.has(key)) continue;
    seen.add(key);
    if (outOfBudget(run, "hub adoption")) break;
    const { adopted, handles } = await adoptHandlesFromOwnPage(
      run.artistId,
      hub.links,
      current as Record<string, unknown>,
      run.artistName,
      { url: hub.url, aboutArtist: hub.aboutArtist },
      run.provisional,
      run,
    );
    for (const h of handles) run.verifiedHandles.add(h);
    if (adopted > 0) {
      Object.assign(current, (await getArtistById(run.artistId).catch(() => undefined)) ?? {});
    }
  }
}
