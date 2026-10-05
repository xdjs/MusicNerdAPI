import { adoptMappedMusicDestinations } from "@/lib/musicLinks/adoptMappedMusicDestinations";
import { getArtistById } from "@/lib/artists/getArtistById";
import { adoptFromHubs } from "@/lib/vault/adoptFromHubs";
import { adoptFromMusicBrainz } from "@/lib/vault/adoptFromMusicBrainz";
import { buildArtistAnchor } from "@/lib/vault/buildArtistAnchor";
import { fileCandidate } from "@/lib/vault/fileCandidate";
import { filterCandidates } from "@/lib/vault/filterCandidates";
import { followIndexLinks } from "@/lib/vault/followIndexLinks";
import { judgeCandidates } from "@/lib/vault/judgeCandidates";
import { outOfBudget } from "@/lib/vault/outOfBudget";
import { propagateRunHandles } from "@/lib/vault/propagateRunHandles";
import { readCandidates } from "@/lib/vault/readCandidates";
import { readExistingUrls } from "@/lib/vault/readExistingUrls";
import { resolveCandidateUrls } from "@/lib/vault/resolveCandidateUrls";
import { searchCandidates } from "@/lib/vault/searchCandidates";
import type { SearchRun, SourceSearchOptions, VaultSource } from "@/lib/vault/types";
import { verifyAccountCandidates } from "@/lib/vault/verifyAccountCandidates";

/**
 * Finds articles, interviews and reviews about an artist and files them as
 * pending vault sources, adopting the accounts it proves along the way.
 * Retrieval is a real search API, so it can't invent a URL, but it can return
 * the wrong person: every candidate is read and judged before anything is
 * written. The deadline is checked before each phase that writes, so an overrun
 * never writes behind the caller.
 *
 * Phases: MusicBrainz, search, intake filter, read, judge, file each page,
 * verify account pages, adopt from the artist's own pages, propagate verified
 * handles, follow index links.
 *
 * @param artistId - The artist.
 * @param opts - The deadline, and whether a failure must throw (a durable job) or return what it has.
 * @returns The sources it saved.
 */
export async function runSourceSearch(
  artistId: string,
  opts: SourceSearchOptions,
): Promise<VaultSource[]> {
  const artist = await getArtistById(artistId);
  if (!artist) return [];
  const artistName = artist.name ?? "Unknown Artist";
  const run: SearchRun = {
    artistId,
    artistName,
    artist: artist as Record<string, unknown>,
    deadline: opts.deadline ?? Number.POSITIVE_INFINITY,
    requireComplete: opts.requireComplete ?? false,
    saved: [],
    existingUrls: new Set(),
    verifiedHandles: new Set(),
    indexLinks: new Set(),
    accountCandidates: [],
    hubCandidates: [],
    counts: { skipped: 0, dropped: 0, rejectedSkips: 0 },
    provisional: new Set(opts.provisionalSiteNames ?? []),
    onSaved: opts.onSaved,
  };

  try {
    if (outOfBudget(run, "catalog discovery")) return run.saved;
    const { existingUrls, rejectedUrls } = await readExistingUrls(artistId);
    run.existingUrls = existingUrls;
    await adoptMappedMusicDestinations(run);

    // Before inferring anything, ask a database that already knows.
    const fromMusicBrainz = outOfBudget(run, "MusicBrainz")
      ? { handles: new Set<string>(), homepage: null, authoritative: false }
      : await adoptFromMusicBrainz(artistId, artistName, run.artist, run.provisional, run);
    if (outOfBudget(run, "web search")) return run.saved;
    // Curated handles are at least as trustworthy as ones read off a page.
    run.verifiedHandles = new Set(fromMusicBrainz.handles);

    const results = await searchCandidates(run, fromMusicBrainz.homepage);
    if (results.length === 0) {
      console.log(`[vaultWebSearch] Web search returned nothing for "${artistName}"`);
      return run.saved;
    }
    const candidates = filterCandidates(run, await resolveCandidateUrls(results), rejectedUrls);

    if (outOfBudget(run, "page verification")) return run.saved;
    const read = await readCandidates(candidates);
    const anchor = await buildArtistAnchor(run.artist, artistName);
    if (outOfBudget(run, "relevance judging")) return run.saved;
    const relevance = await judgeCandidates(anchor, read);

    for (const candidate of read) {
      if ((await fileCandidate(run, candidate, relevance.get(candidate.result.url))) === "stop")
        break;
    }
    await verifyAccountCandidates(run);
    await adoptFromHubs(run);
    await propagateRunHandles(run, fromMusicBrainz.authoritative);
    await followIndexLinks(run, anchor);

    const { skipped, dropped, rejectedSkips } = run.counts;
    if (skipped > 0) {
      console.log(
        `[vaultWebSearch] Skipped ${skipped} duplicate(s) for "${artistName}"${rejectedSkips > 0 ? `, ${rejectedSkips} previously rejected by the artist` : ""}`,
      );
    }
    if (dropped > 0) {
      console.log(
        `[vaultWebSearch] Dropped ${dropped} unverifiable candidate(s) for "${artistName}"`,
      );
    }
    outOfBudget(run, "completion");
    console.log(`[vaultWebSearch] Inserted ${run.saved.length} sources for "${artistName}"`);
    return run.saved;
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; code?: string };
    console.error("[vaultWebSearch] Error searching for artist:", {
      message: err.message,
      status: err.status,
      code: err.code,
      full: error,
    });
    if (run.requireComplete) throw error;
    return run.saved;
  }
}
