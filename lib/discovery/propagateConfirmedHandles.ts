import { mapWithConcurrency } from "@/lib/async/mapWithConcurrency";
import { PROBE_CONCURRENCY, PROBE_UNVERIFIABLE_PLATFORMS } from "@/lib/discovery/const";
import { probeCandidate } from "@/lib/discovery/probeCandidate";
import { runHandleProbe } from "@/lib/discovery/runHandleProbe";
import type { HandleProbe, TierCandidate } from "@/lib/discovery/types";
import type { ProfileDisplayColumn, UrlmapPresentationRow } from "@/lib/links/types";

/**
 * Feeds handles tier 4's search confirmed back into probing, so one found
 * Instagram can resolve the other platforms that reuse its handle without a
 * search each. Tagged tier 3: a probe result, not a search result.
 *
 * @param handles - Handles confirmed by search.
 * @param targets - Platforms still missing.
 * @param urlmapBySiteName - urlmap rows by column.
 * @param artistName - The resolved name.
 * @yields `[platform, candidate]` for the first hit per platform.
 */
export async function* propagateConfirmedHandles(
  handles: Set<string>,
  targets: ProfileDisplayColumn[],
  urlmapBySiteName: Map<string, UrlmapPresentationRow>,
  artistName: string,
): AsyncGenerator<[ProfileDisplayColumn, TierCandidate | null]> {
  const probeTargets = targets.filter(p => !PROBE_UNVERIFIABLE_PLATFORMS.has(p));
  if (probeTargets.length === 0 || handles.size === 0) return;
  const jobs: HandleProbe[] = [];
  for (const handle of handles)
    for (const platform of probeTargets)
      jobs.push({ platform, handle, source: "propagated from web search", confirmed: true });
  const resolved = new Set<ProfileDisplayColumn>();
  for await (const [probe, hit] of mapWithConcurrency(jobs, PROBE_CONCURRENCY, p =>
    runHandleProbe(p, urlmapBySiteName, artistName),
  )) {
    if (!hit || resolved.has(probe.platform)) continue;
    resolved.add(probe.platform);
    yield [
      probe.platform,
      probeCandidate(probe, hit, artistName, "propagated from a handle confirmed via web search"),
    ];
  }
}
