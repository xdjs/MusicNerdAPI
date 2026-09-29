import { MAPPING_PLATFORM_TO_COLUMN } from "@/lib/discovery/const";
import { getArtistIdMappings } from "@/lib/discovery/getArtistIdMappings";
import type { TierCandidate } from "@/lib/discovery/types";
import type { ProfileDisplayColumn, UrlmapPresentationRow } from "@/lib/links/types";

/**
 * Tier 1: already-resolved cross-platform ids, free and authoritative. Low
 * confidence rows are skipped; "manual" (human-entered) is kept.
 *
 * @param artistId - The artist.
 * @param missing - Columns still to find.
 * @param urlmapBySiteName - urlmap rows by column, for the URL shape.
 * @returns The candidates; never throws.
 */
export async function tierOneIdMappings(
  artistId: string,
  missing: Set<ProfileDisplayColumn>,
  urlmapBySiteName: Map<string, UrlmapPresentationRow>,
): Promise<TierCandidate[]> {
  if (missing.size === 0) return [];
  try {
    const out: TierCandidate[] = [];
    for (const m of await getArtistIdMappings(artistId)) {
      if (m.confidence === "low") continue;
      const column = MAPPING_PLATFORM_TO_COLUMN[m.platform];
      if (!column || !missing.has(column)) continue;
      const row = urlmapBySiteName.get(column);
      if (!row?.appStringFormat) continue;
      out.push({
        tier: 1,
        platform: column,
        url: row.appStringFormat.replace("%@", m.platformId),
        reasoning: `Cross-platform ID mapping (${m.confidence} confidence, source: ${m.source})`,
      });
    }
    return out;
  } catch (e) {
    console.error(`[profileDiscovery] tier1 (id mappings) failed for artist=${artistId}:`, e);
    return [];
  }
}
