import { webSearch } from "@/lib/search/webSearch";
import { inferTypeFromUrl } from "@/lib/sources/inferTypeFromUrl";
import { normalizeLoreDiscoveryUrl } from "@/lib/sources/normalizeLoreDiscoveryUrl";
import { TAVILY_RESULTS_PER_QUERY } from "@/lib/vault/const";
import { sourceSearchQueries } from "@/lib/vault/sourceSearchQueries";
import type { DiscoveryResult, SearchRun } from "@/lib/vault/types";

/**
 * Runs the source search's queries and dedupes what comes back. A homepage
 * MusicBrainz named goes in first, so it survives the dedupe: it's the hub
 * that lists the artist's real accounts, and search doesn't always return it.
 * Each result is typed by its URL, which can't be invented.
 *
 * @param run - The run, for the name and whether it must complete.
 * @param homepage - The homepage MusicBrainz named, or null.
 * @returns The candidates, one per normalized URL. Throws on a failed search for a durable run.
 */
export async function searchCandidates(
  run: SearchRun,
  homepage: string | null,
): Promise<DiscoveryResult[]> {
  const perQuery = await Promise.all(
    sourceSearchQueries(run.artistName).map(q =>
      webSearch(q, {
        maxResults: TAVILY_RESULTS_PER_QUERY,
        ...(run.requireComplete ? { throwOnError: true } : {}),
      }),
    ),
  );
  const seeded = homepage ? [{ url: homepage, title: run.artistName, snippet: "" }] : [];
  if (homepage) {
    console.log(
      `[vaultWebSearch] Seeding MusicBrainz homepage into discovery: ${homepage.slice(0, 70)}`,
    );
  }
  const byUrl = new Map<string, DiscoveryResult>();
  for (const hit of [...seeded, ...perQuery.flat()]) {
    if (!hit.url || !hit.title) continue;
    const key = normalizeLoreDiscoveryUrl(hit.url);
    if (byUrl.has(key)) continue;
    byUrl.set(key, {
      url: hit.url,
      title: hit.title,
      snippet: hit.snippet ?? "",
      type: inferTypeFromUrl(hit.url),
    });
  }
  return [...byUrl.values()];
}
