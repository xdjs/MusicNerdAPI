import type { ArtistAnchor } from "@/lib/relevance/types";
import { normalizeLoreDiscoveryUrl } from "@/lib/sources/normalizeLoreDiscoveryUrl";
import { fileCandidate } from "@/lib/vault/fileCandidate";
import { filterCandidates } from "@/lib/vault/filterCandidates";
import { judgeCandidates } from "@/lib/vault/judgeCandidates";
import { outOfBudget } from "@/lib/vault/outOfBudget";
import { readCandidates } from "@/lib/vault/readCandidates";
import { resolveCandidateUrls } from "@/lib/vault/resolveCandidateUrls";
import type { DiscoveryResult, SearchRun } from "@/lib/vault/types";

/**
 * Runs discovered URLs through the shared intake, fetched-page, relevance and
 * filing checks. Both broad discovery and bounded channel rounds use this path.
 *
 * @param run - Shared identity, deadline, deduplication and result state.
 * @param results - Untrusted search hits.
 * @param rejectedUrls - Sources previously rejected by the artist.
 * @param anchor - Existing verified identity context for the relevance judge.
 * @returns Once this batch has been processed, or its deadline stops it.
 */
export async function processDiscoveryCandidates(
  run: SearchRun,
  results: DiscoveryResult[],
  rejectedUrls: Set<string>,
  anchor: ArtistAnchor,
): Promise<void> {
  if (!results.length || outOfBudget(run, "page verification")) return;
  const candidates = filterCandidates(run, await resolveCandidateUrls(results), rejectedUrls);
  if (!candidates.length || outOfBudget(run, "page verification")) return;
  const read = (await readCandidates(candidates)).filter(
    candidate =>
      !candidate.discoveredUrl ||
      normalizeLoreDiscoveryUrl(candidate.discoveredUrl) ===
        normalizeLoreDiscoveryUrl(candidate.result.url) ||
      filterCandidates(run, [candidate.result], rejectedUrls).length > 0,
  );
  if (outOfBudget(run, "relevance judging")) return;
  const relevance = await judgeCandidates(anchor, read);
  for (const candidate of read) {
    if (outOfBudget(run, "candidate filing")) break;
    if ((await fileCandidate(run, candidate, relevance.get(candidate.result.url))) === "stop")
      break;
  }
}
