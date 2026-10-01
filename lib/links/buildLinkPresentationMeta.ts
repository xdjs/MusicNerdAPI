import { fallbackDisplayName } from "@/lib/links/fallbackDisplayName";
import type { LinkPresentationMeta, UrlmapPresentationRow } from "@/lib/links/types";

/**
 * Logo, color, display name and profile URL for one {siteName, value} pair,
 * the same rule for confirmed links and discovered candidates, so the two
 * render identically.
 *
 * @param row - The column's urlmap row, or undefined when there is none.
 * @param siteName - The column.
 * @param value - The artist's handle or id there.
 * @returns The presentation fields.
 */
export function buildLinkPresentationMeta(
  row: UrlmapPresentationRow | undefined,
  siteName: string,
  value: string,
): LinkPresentationMeta {
  const displayName = row?.cardPlatformName || fallbackDisplayName(siteName);
  const logoUrl = row?.siteImage || null;
  // urlmap defaults colorHex to '#000000' for rows with no brand color; that
  // placeholder is "no color", or dark mode draws a black ring.
  const trimmedColor = row?.colorHex?.trim() || null;
  const colorHex = trimmedColor && trimmedColor.toLowerCase() !== "#000000" ? trimmedColor : null;
  const profileUrl = row?.appStringFormat ? row.appStringFormat.replace("%@", value) : null;
  return { displayName, logoUrl, colorHex, profileUrl };
}
