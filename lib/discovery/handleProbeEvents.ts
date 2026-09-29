import { acceptCandidate } from "@/lib/discovery/acceptCandidate";
import { HANDLE_BASED_PLATFORM_DOMAINS } from "@/lib/discovery/const";
import { platformEvent } from "@/lib/discovery/platformEvent";
import { tierThreeHandleProbeStream } from "@/lib/discovery/tierThreeHandleProbeStream";
import type { DiscoveryEvent, DiscoveryRun } from "@/lib/discovery/types";
import type { ProfileDisplayColumn } from "@/lib/links/types";

/**
 * Tier 3's events: direct handle probes.
 *
 * @param run - The discovery run; proposed columns leave `missing`, walls go in `walled`.
 * @param artistName - The resolved name.
 * @yields searching, found and checked events.
 */
export async function* handleProbeEvents(
  run: DiscoveryRun,
  artistName: string,
): AsyncGenerator<DiscoveryEvent> {
  const targets = (Object.keys(HANDLE_BASED_PLATFORM_DOMAINS) as ProfileDisplayColumn[]).filter(p =>
    run.missing.has(p),
  );
  for (const p of targets) yield platformEvent("searching", p, run.urlmapBySiteName);
  for await (const [platform, candidate] of tierThreeHandleProbeStream(
    artistName,
    run.record,
    run.missing,
    run.urlmapBySiteName,
    run.walled,
  )) {
    if (candidate) {
      run.missing.delete(candidate.platform);
      const found = await acceptCandidate(run, candidate);
      if (found) yield found;
    }
    yield platformEvent("checked", platform, run.urlmapBySiteName);
  }
}
