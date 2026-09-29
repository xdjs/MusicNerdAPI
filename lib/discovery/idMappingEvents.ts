import { acceptCandidate } from "@/lib/discovery/acceptCandidate";
import { MAPPING_PLATFORM_TO_COLUMN } from "@/lib/discovery/const";
import { platformEvent } from "@/lib/discovery/platformEvent";
import { tierOneIdMappings } from "@/lib/discovery/tierOneIdMappings";
import type { DiscoveryEvent, DiscoveryRun } from "@/lib/discovery/types";
import type { ProfileDisplayColumn } from "@/lib/links/types";

/**
 * Tier 1's events: free, instant, authoritative id mappings.
 *
 * @param run - The discovery run; proposed columns leave `missing`.
 * @yields searching, found and checked events.
 */
export async function* idMappingEvents(run: DiscoveryRun): AsyncGenerator<DiscoveryEvent> {
  const targets = (
    Object.values(MAPPING_PLATFORM_TO_COLUMN) as (ProfileDisplayColumn | undefined)[]
  ).filter((p): p is ProfileDisplayColumn => !!p && run.missing.has(p));
  for (const p of targets) yield platformEvent("searching", p, run.urlmapBySiteName);
  const candidates = await tierOneIdMappings(run.artistId, run.missing, run.urlmapBySiteName);
  for (const c of candidates) run.missing.delete(c.platform);
  for (const c of candidates) {
    const found = await acceptCandidate(run, c);
    if (found) yield found;
  }
  for (const p of targets) yield platformEvent("checked", p, run.urlmapBySiteName);
}
