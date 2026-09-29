import { withoutAt } from "@/lib/artists/withoutAt";
import { acceptCandidate } from "@/lib/discovery/acceptCandidate";
import { HANDLE_BASED_PLATFORM_DOMAINS } from "@/lib/discovery/const";
import { platformEvent } from "@/lib/discovery/platformEvent";
import { propagateConfirmedHandles } from "@/lib/discovery/propagateConfirmedHandles";
import { tierFourWebSearchStream } from "@/lib/discovery/tierFourWebSearchStream";
import type { DiscoveryEvent, DiscoveryRun } from "@/lib/discovery/types";
import type { ProfileDisplayColumn } from "@/lib/links/types";
import type { MusicPlatformArtist } from "@/lib/musicPlatform/types";

/**
 * Tier 4's events, the last resort: a domain-scoped web search per platform,
 * the first result to clear validation winning, then its handle propagated
 * through probing to whatever is still missing, while the budget allows.
 *
 * @param run - The discovery run; found columns leave `missing`.
 * @param artistName - The resolved name.
 * @param enrichment - Their platform data, for the query.
 * @yields searching, found and checked events.
 */
export async function* webSearchEvents(
  run: DiscoveryRun,
  artistName: string,
  enrichment: MusicPlatformArtist | null,
): AsyncGenerator<DiscoveryEvent> {
  const handlePlatforms = Object.keys(HANDLE_BASED_PLATFORM_DOMAINS) as ProfileDisplayColumn[];
  for (const p of handlePlatforms.filter(p => run.missing.has(p)))
    yield platformEvent("searching", p, run.urlmapBySiteName);
  const confirmedHandles = new Set<string>();
  for await (const [platform, candidates] of tierFourWebSearchStream(
    artistName,
    enrichment,
    run.missing,
  )) {
    for (const candidate of candidates ?? []) {
      const found = await acceptCandidate(run, candidate);
      if (!found || found.kind !== "found") continue;
      run.missing.delete(candidate.platform);
      // Facebook's regex can keep a leading "@"; the probe needs the bare handle.
      confirmedHandles.add(withoutAt(found.profile.value.trim()));
      yield found;
      break;
    }
    yield platformEvent("checked", platform, run.urlmapBySiteName);
  }
  if (run.missing.size === 0 || confirmedHandles.size === 0 || Date.now() > run.deadline) return;
  const targets = handlePlatforms.filter(p => run.missing.has(p));
  for (const p of targets) yield platformEvent("searching", p, run.urlmapBySiteName);
  for await (const [, candidate] of propagateConfirmedHandles(
    confirmedHandles,
    targets,
    run.urlmapBySiteName,
    artistName,
  )) {
    if (!candidate) continue;
    run.missing.delete(candidate.platform);
    const found = await acceptCandidate(run, candidate);
    if (found) yield found;
  }
  for (const p of targets) yield platformEvent("checked", p, run.urlmapBySiteName);
}
