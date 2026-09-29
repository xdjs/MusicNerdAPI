import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import { isBlockedSourceHost } from "@/lib/sources/isBlockedSourceHost";
import { isExcludedLoreDiscoveryUrl } from "@/lib/sources/isExcludedLoreDiscoveryUrl";
import { isMachineFormatUrl } from "@/lib/sources/isMachineFormatUrl";
import { normalizeLoreDiscoveryUrl } from "@/lib/sources/normalizeLoreDiscoveryUrl";
import { isKnownProfileUrl } from "@/lib/vault/isKnownProfileUrl";
import type { DiscoveryResult, SearchRun } from "@/lib/vault/types";

/**
 * Drops what isn't worth fetching, before any fetch is spent on it: profiles we
 * already hold, feeds, hosts with no author (scrape farms), LinkedIn, unsafe
 * URLs, and anything already in the vault. Kept URLs join `run.existingUrls`
 * so a later duplicate in the same batch is dropped too.
 *
 * @param run - The run; its URL set and counts are updated.
 * @param results - The resolved candidates.
 * @param rejectedUrls - Normalized URLs the artist rejected, counted apart in the log.
 * @returns The candidates worth fetching.
 */
export function filterCandidates(
  run: SearchRun,
  results: DiscoveryResult[],
  rejectedUrls: Set<string>,
): DiscoveryResult[] {
  const candidates: DiscoveryResult[] = [];
  for (const result of results) {
    if (isKnownProfileUrl(result.url, run.artist)) {
      run.counts.skipped++;
      continue;
    }
    if (isMachineFormatUrl(result.url)) {
      console.log(
        `[vaultWebSearch] Skipping machine format (feed/XML): ${result.url.slice(0, 100)}`,
      );
      run.counts.skipped++;
      continue;
    }
    if (isBlockedSourceHost(result.url) || isExcludedLoreDiscoveryUrl(result.url)) {
      console.log(`[vaultWebSearch] Blocked host, not a source: ${result.url.slice(0, 100)}`);
      run.counts.skipped++;
      continue;
    }
    if (isUnsafeUrl(result.url)) {
      console.warn(`[vaultWebSearch] Skipping unsafe URL: ${result.url.slice(0, 100)}`);
      continue;
    }
    const normalized = normalizeLoreDiscoveryUrl(result.url);
    if (run.existingUrls.has(normalized)) {
      if (rejectedUrls.has(normalized)) run.counts.rejectedSkips++;
      run.counts.skipped++;
      continue;
    }
    run.existingUrls.add(normalized);
    candidates.push(result);
  }
  return candidates;
}
