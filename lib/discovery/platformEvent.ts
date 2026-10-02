import { platformDisplayName } from "@/lib/discovery/platformDisplayName";
import type { DiscoveryEvent } from "@/lib/discovery/types";
import type { ProfileDisplayColumn, UrlmapPresentationRow } from "@/lib/links/types";

/**
 * A per-platform progress event, named for its chip.
 *
 * @param kind - searching, checked or unreachable.
 * @param platform - The column.
 * @param urlmapBySiteName - urlmap rows by column.
 * @returns The event.
 */
export function platformEvent(
  kind: "searching" | "checked" | "unreachable",
  platform: ProfileDisplayColumn,
  urlmapBySiteName: Map<string, UrlmapPresentationRow>,
): DiscoveryEvent {
  return { kind, platform, displayName: platformDisplayName(platform, urlmapBySiteName) };
}
