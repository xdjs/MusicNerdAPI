import { adoptMusicDestinations } from "@/lib/musicLinks/adoptMusicDestinations";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import type { SearchRun } from "@/lib/vault/types";
import { extractArtistId } from "@/lib/artists/extractArtistId";
import { isReservedHandle } from "@/lib/artists/isReservedHandle";
import { contradictsScrapedPosts } from "@/lib/identity/contradictsScrapedPosts";
import { handleBelongsToAnotherArtist } from "@/lib/identity/handleBelongsToAnotherArtist";
import { nameIsAmbiguousInDirectory } from "@/lib/identity/nameIsAmbiguousInDirectory";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";
import { fetchMusicBrainzLinks } from "@/lib/musicbrainz/fetchMusicBrainzLinks";
import { stripQuery } from "@/lib/sources/stripQuery";
import { ACCOUNT_PLATFORMS, REFERENCE_PLATFORMS } from "@/lib/vault/const";
import { holdsAnswerFor } from "@/lib/vault/holdsAnswerFor";
import { pageNamesArtist } from "@/lib/vault/pageNamesArtist";
import { outOfBudget } from "@/lib/vault/outOfBudget";
import { writeArtistLink } from "@/lib/vault/writeArtistLink";

/**
 * Takes the artist's links from MusicBrainz before inferring any from search.
 * An identifier match is adopted as is; an exact-name match gets the same page
 * check a search result would, and nothing for a name the directory shares.
 * Every candidate still clears the reserved-handle and identity guards.
 *
 * @param artistId - The artist.
 * @param artistName - Their name.
 * @param artist - The artist row snapshot; updated as links are written.
 * @param provisional - Columns holding a discovery guess (see holdsAnswerFor).
 * @returns The handles adopted (for propagation), their homepage, and whether the match was by identifier. A durable run propagates failed source writes for retry.
 */
export async function adoptFromMusicBrainz(
  artistId: string,
  artistName: string,
  artist: Record<string, unknown>,
  provisional?: Set<string>,
  run?: SearchRun,
): Promise<{ handles: Set<string>; homepage: string | null; authoritative: boolean }> {
  const handles = new Set<string>();
  try {
    const found = await fetchMusicBrainzLinks(artistName, {
      spotify: artist.spotify as string | null,
      deezer: artist.deezer as string | null,
    });
    if (!found) return { handles, homepage: null, authoritative: false };

    console.log(
      `[vaultWebSearch] MusicBrainz matched "${artistName}" by ${found.matchedBy}, ${found.urls.length} link(s)`,
    );
    if (run)
      await adoptMusicDestinations(
        run,
        found.urls,
        found.matchedBy === "identifier" ? "identifier" : "name",
      );
    for (const url of found.urls) {
      if (run && outOfBudget(run, "MusicBrainz handle verification")) break;
      const music = parseMusicDestination(url);
      // The release uploader may be a label or collaborator, not this artist.
      if (music?.kind === "release") continue;
      const match = await extractArtistId(stripQuery(url)).catch(() => undefined);
      if (!match?.siteName || !match?.id) continue;
      if (!ACCOUNT_PLATFORMS.has(match.siteName) && !REFERENCE_PLATFORMS.has(match.siteName))
        continue;
      const id = String(match.id);
      if (isReservedHandle(match.siteName, id)) continue;
      if (holdsAnswerFor(artist, match.siteName, provisional)) continue;
      if (await handleBelongsToAnotherArtist(artistId, match.siteName, id)) continue;
      if (await contradictsScrapedPosts(artistId, match.siteName, id)) {
        console.log(
          `[vaultWebSearch] MusicBrainz lists ${match.siteName}=${id}, but their own posts are authored by a different handle — ignoring`,
        );
        continue;
      }
      if (found.matchedBy === "exact-name") {
        // A name match is the same claim a search result makes; a shared name settles nothing.
        if (await nameIsAmbiguousInDirectory(artistId, artistName)) {
          console.log(
            `[vaultWebSearch] MusicBrainz matched "${artistName}" by name only, but that name is shared in this directory — not adopting`,
          );
          break;
        }
        if (!(await pageNamesArtist(stripQuery(url), artistName))) {
          console.log(
            `[vaultWebSearch] MusicBrainz lists ${match.siteName}=${id} but the page is not "${artistName}", ignoring`,
          );
          continue;
        }
      }
      if (run && outOfBudget(run, "MusicBrainz handle insertion")) break;
      try {
        await writeArtistLink(artistId, match.siteName, id, provisional, artist);
        console.log(`[vaultWebSearch] MusicBrainz -> ${match.siteName}=${id}`);
        handles.add(normalizeHandle(id));
      } catch (e) {
        console.warn(`[vaultWebSearch] Could not save ${match.siteName} from MusicBrainz:`, e);
      }
    }
    // An identifier match is curated and authoritative: guessing the platforms
    // it didn't name only adds mistakes.
    return { handles, homepage: found.homepage, authoritative: found.matchedBy === "identifier" };
  } catch (e) {
    console.error("[vaultWebSearch] MusicBrainz lookup failed:", e);
    if (run?.requireComplete) throw e;
    return { handles, homepage: null, authoritative: false };
  }
}
