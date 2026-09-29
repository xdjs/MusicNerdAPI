import { fallbackDisplayName } from "@/lib/links/fallbackDisplayName";
import type { UrlmapPresentationRow } from "@/lib/links/types";

/**
 * A platform's name for the progress chips.
 *
 * @param platform - The column.
 * @param urlmapBySiteName - urlmap rows by column.
 * @returns urlmap's card name, or the capitalized column.
 */
export function platformDisplayName(
  platform: string,
  urlmapBySiteName: Map<string, UrlmapPresentationRow>,
): string {
  return urlmapBySiteName.get(platform)?.cardPlatformName || fallbackDisplayName(platform);
}
