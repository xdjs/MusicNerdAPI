import { acceptCandidate } from "@/lib/discovery/acceptCandidate";
import { HANDLE_BASED_PLATFORM_DOMAINS } from "@/lib/discovery/const";
import { platformEvent } from "@/lib/discovery/platformEvent";
import { tierFourWebSearchStream } from "@/lib/discovery/tierFourWebSearchStream";
import type { DiscoveryEvent, DiscoveryRun } from "@/lib/discovery/types";
import type { ProfileDisplayColumn } from "@/lib/links/types";
import type { MusicPlatformArtist } from "@/lib/musicPlatform/types";

/**
 * Tier 4's events, the last resort: a domain-scoped web search per platform,
 * retaining the first valid candidate per platform. A web name match is not
 * independent ownership evidence and cannot seed other platform discoveries.
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
  for await (const [platform, candidates] of tierFourWebSearchStream(
    artistName,
    enrichment,
    run.missing,
    run.requireComplete,
  )) {
    for (const candidate of candidates ?? []) {
      const found = await acceptCandidate(run, candidate);
      if (!found || found.kind !== "found") continue;
      run.missing.delete(candidate.platform);
      yield found;
      break;
    }
    yield platformEvent("checked", platform, run.urlmapBySiteName);
  }
}
