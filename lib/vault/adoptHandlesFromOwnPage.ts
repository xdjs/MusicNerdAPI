import { adoptMusicDestinations } from "@/lib/musicLinks/adoptMusicDestinations";
import type { SearchRun } from "@/lib/vault/types";
import { isReservedHandle } from "@/lib/artists/isReservedHandle";
import { contradictsScrapedPosts } from "@/lib/identity/contradictsScrapedPosts";
import { handleBelongsToAnotherArtist } from "@/lib/identity/handleBelongsToAnotherArtist";
import { nameIsAmbiguousInDirectory } from "@/lib/identity/nameIsAmbiguousInDirectory";
import { ambiguousPlatforms } from "@/lib/vault/ambiguousPlatforms";
import { ACCOUNT_PLATFORMS, HANDLE_STEM_MIN, REFERENCE_PLATFORMS } from "@/lib/vault/const";
import { findCorroborator } from "@/lib/vault/findCorroborator";
import { holdsAnswerFor } from "@/lib/vault/holdsAnswerFor";
import { isArtistOwnDomain } from "@/lib/vault/isArtistOwnDomain";
import { resolveOutboundHandles } from "@/lib/vault/resolveOutboundHandles";
import { sharedPrefix } from "@/lib/vault/sharedPrefix";
import { writeArtistLink } from "@/lib/vault/writeArtistLink";
import { outOfBudget } from "@/lib/vault/outOfBudget";

/**
 * Adopts the account handles an artist published on their own page, which
 * live only in hrefs. The page must be theirs: it links an id we already hold,
 * or it is their own domain and the judge says it is about them (and their
 * name isn't shared). When some handles resemble the artist and others don't,
 * only the resembling ones are kept; a page naming two handles for one
 * platform adopts neither. Propagation is left to the caller, once per run.
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
  const resolved = await resolveOutboundHandles(outboundLinks);
  const corroborator = findCorroborator(resolved, artist, provisional);
  const ownDomain =
    !corroborator &&
    !!page?.aboutArtist &&
    isArtistOwnDomain(page.url, String(artist.name ?? "")) &&
    !(await nameIsAmbiguousInDirectory(artistId, String(artist.name ?? "")));
  if (!corroborator && !ownDomain) return { adopted: 0, handles: new Set<string>() };
  console.log(
    corroborator
      ? `[vaultWebSearch] Page corroborated by known ${corroborator.siteName}=${corroborator.id}`
      : `[vaultWebSearch] Page corroborated as the artist's own domain: ${page!.url.slice(0, 70)}`,
  );

  if (run) await adoptMusicDestinations(run, outboundLinks, "own-page");
  const ambiguous = ambiguousPlatforms(resolved);
  for (const platform of ambiguous) {
    console.log(`[vaultWebSearch] Own page names more than one ${platform} handle — adopting none`);
  }
  const accountHandles = resolved.filter(
    r => ACCOUNT_PLATFORMS.has(r.siteName) || REFERENCE_PLATFORMS.has(r.siteName),
  );
  const anyResembles = accountHandles.some(r => sharedPrefix(r.id, artistName) >= HANDLE_STEM_MIN);

  let adopted = 0;
  const done = new Set<string>();
  const adoptedHandles = new Set<string>();
  for (const r of accountHandles) {
    if (run && outOfBudget(run, "own-page handle verification")) break;
    if (anyResembles && sharedPrefix(r.id, artistName) < HANDLE_STEM_MIN) {
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
