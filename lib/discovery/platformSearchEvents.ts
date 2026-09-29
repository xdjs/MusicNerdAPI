import { acceptCandidate } from "@/lib/discovery/acceptCandidate";
import { platformEvent } from "@/lib/discovery/platformEvent";
import { tierTwoPlatformSearchStream } from "@/lib/discovery/tierTwoPlatformSearchStream";
import type { DiscoveryEvent, DiscoveryRun } from "@/lib/discovery/types";

/**
 * Tier 2's events: Spotify and Deezer's own searches.
 *
 * @param run - The discovery run; proposed columns leave `missing`.
 * @param artistName - The resolved name.
 * @yields searching, found and checked events.
 */
export async function* platformSearchEvents(
  run: DiscoveryRun,
  artistName: string,
): AsyncGenerator<DiscoveryEvent> {
  for (const p of (["spotify", "deezer"] as const).filter(p => run.missing.has(p)))
    yield platformEvent("searching", p, run.urlmapBySiteName);
  for await (const [platform, candidate] of tierTwoPlatformSearchStream(
    artistName,
    run.missing,
    run.record,
  )) {
    if (candidate) {
      run.missing.delete(candidate.platform);
      const found = await acceptCandidate(run, candidate);
      if (found) yield found;
    }
    yield platformEvent("checked", platform, run.urlmapBySiteName);
  }
}
