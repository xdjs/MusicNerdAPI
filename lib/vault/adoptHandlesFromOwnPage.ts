import { adoptMusicDestinations } from "@/lib/musicLinks/adoptMusicDestinations";
import type { SearchRun } from "@/lib/vault/types";
import { isReservedHandle } from "@/lib/artists/isReservedHandle";
import { contradictsScrapedPosts } from "@/lib/identity/contradictsScrapedPosts";
import { handleBelongsToAnotherArtist } from "@/lib/identity/handleBelongsToAnotherArtist";
import { nameIsAmbiguousInDirectory } from "@/lib/identity/nameIsAmbiguousInDirectory";
import { ambiguousPlatforms } from "@/lib/vault/ambiguousPlatforms";
import {
  ACCOUNT_PLATFORMS,
  HANDLE_STEM_MIN,
  OPAQUE_ACCOUNT_PLATFORMS,
  REFERENCE_PLATFORMS,
} from "@/lib/vault/const";
import { findCorroborator } from "@/lib/vault/findCorroborator";
import { holdsAnswerFor } from "@/lib/vault/holdsAnswerFor";
import { isArtistOwnDomain } from "@/lib/vault/isArtistOwnDomain";
import { resolveOutboundHandles } from "@/lib/vault/resolveOutboundHandles";
import { sharedPrefix } from "@/lib/vault/sharedPrefix";
import { writeArtistLink } from "@/lib/vault/writeArtistLink";
import { outOfBudget } from "@/lib/vault/outOfBudget";

/**
 * Adopts the account handles an artist published on their own page, which
 * live only in hrefs. The referring page must itself match a saved artist
 * account, or pass the existing own-domain and affirmative relevance checks
 * (and their name isn't shared). Outbound links to known accounts do not prove
 * ownership of a review or other third-party page. When some handles resemble
 * the artist and others don't, only the resembling ones and provider-assigned
 * opaque IDs are kept; a page naming two handles for one platform adopts neither. Propagation is left to the caller, once per run.
 * The same authority applies to social accounts and catalog sources. Missing
 * or rejected referring pages cannot supply either branch; provisional accounts
 * cannot establish authority.
 *
 * @param artistId - The artist.
 * @param outboundLinks - The page's off-host links.
 * @param artist - The artist row snapshot; updated as links are written.
 * @param artistName - Their name.
 * @param page - The page's URL and whether the judge found it about them.
 * @param page.url - The page URL.
 * @param page.aboutArtist - The judge's verdict.
 * @param provisional - Columns holding a discovery guess (see holdsAnswerFor).
 * @returns How many links were written, and the handles adopted.
 */
export async function adoptHandlesFromOwnPage(
  artistId: string,
  outboundLinks: string[],
  artist: Record<string, unknown>,
  artistName: string,
  page?: { url: string; aboutArtist: boolean },
  provisional?: Set<string>,
  run?: SearchRun,
): Promise<{ adopted: number; handles: Set<string> }> {
  if (!page?.aboutArtist) return { adopted: 0, handles: new Set<string>() };
  const resolved = await resolveOutboundHandles(outboundLinks);
  const ownDomain =
    isArtistOwnDomain(page.url, String(artist.name ?? "")) &&
    !(await nameIsAmbiguousInDirectory(artistId, String(artist.name ?? "")));
  let ownedPage = ownDomain;
  if (!ownedPage) {
    // An outbound public link can corroborate identity, but does not prove who
    // controls its referring page. Every adoption needs that page's own authority.
    const pageAccounts = await resolveOutboundHandles([page.url]);
    const heldPage = findCorroborator(
      pageAccounts.filter(
        handle =>
          !handle.corroborationOnly &&
          ACCOUNT_PLATFORMS.has(handle.siteName) &&
          !isReservedHandle(handle.siteName, handle.id),
      ),
      artist,
      provisional,
    );
    if (run && outOfBudget(run, "hub authority")) return { adopted: 0, handles: new Set<string>() };
    ownedPage = !!heldPage;
  }
  if (!ownedPage) return { adopted: 0, handles: new Set<string>() };
  console.log(`[vaultWebSearch] Matched hub authority: ${page.url.slice(0, 70)}`);
  if (run) await adoptMusicDestinations(run, outboundLinks, "own-page");
  const adoptable = resolved.filter(handle => !handle.corroborationOnly);
  const ambiguous = ambiguousPlatforms(adoptable);
  for (const platform of ambiguous) {
    console.log(`[vaultWebSearch] Own page names more than one ${platform} handle — adopting none`);
  }
  const accountHandles = adoptable.filter(
    r => ACCOUNT_PLATFORMS.has(r.siteName) || REFERENCE_PLATFORMS.has(r.siteName),
  );
  const anyResembles = accountHandles.some(r => sharedPrefix(r.id, artistName) >= HANDLE_STEM_MIN);

  let adopted = 0;
  const done = new Set<string>();
  const adoptedHandles = new Set<string>();
  for (const r of accountHandles) {
    if (run && outOfBudget(run, "own-page handle verification")) break;
    // Provider-assigned IDs cannot resemble the artist name. Only an
    // affirmed own domain or saved owned account can supply that exception;
    // third-party corroboration alone still cannot bypass the mixed-handle guard.
    if (
      anyResembles &&
      sharedPrefix(r.id, artistName) < HANDLE_STEM_MIN &&
      !(ownedPage && OPAQUE_ACCOUNT_PLATFORMS.has(r.siteName))
    ) {
      console.log(
        `[vaultWebSearch] Page mixes "${artistName}" accounts with ${r.siteName}=${r.id}; keeping only theirs`,
      );
      continue;
    }
    if (isReservedHandle(r.siteName, r.id)) continue;
    if (ambiguous.has(r.siteName) || done.has(r.siteName)) continue;
    if (holdsAnswerFor(artist, r.siteName, provisional)) continue;
    if (await contradictsScrapedPosts(artistId, r.siteName, r.id)) {
      console.log(
        `[vaultWebSearch] ${r.siteName}=${r.id} contradicts the handle their own posts are authored by, ignoring`,
      );
      continue;
    }
    if (await handleBelongsToAnotherArtist(artistId, r.siteName, r.id)) {
      console.log(
        `[vaultWebSearch] ${r.siteName}=${r.id} is already another artist's, not adopting from the hub page`,
      );
      continue;
    }
    if (run && outOfBudget(run, "own-page handle insertion")) break;
    try {
      await writeArtistLink(artistId, r.siteName, r.id, provisional, artist);
      console.log(`[vaultWebSearch] Adopted ${r.siteName}=${r.id} from the artist's own page`);
      done.add(r.siteName);
      adoptedHandles.add(r.id);
      adopted++;
    } catch (e) {
      console.warn(`[vaultWebSearch] Could not save ${r.siteName} from own page:`, e);
    }
  }
  return { adopted, handles: adoptedHandles };
}
