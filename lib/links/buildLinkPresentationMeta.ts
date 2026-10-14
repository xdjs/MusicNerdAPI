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
  const displayName =
    row?.cardPlatformName ||
    (siteName === "youtubechannel" ? "YouTube" : fallbackDisplayName(siteName));
  const logoUrl = row?.siteImage || null;
  // urlmap defaults colorHex to '#000000' for rows with no brand color; that
  // placeholder is "no color", or dark mode draws a black ring.
  const trimmedColor = row?.colorHex?.trim() || null;
  const colorHex = trimmedColor && trimmedColor.toLowerCase() !== "#000000" ? trimmedColor : null;
  // These stored values are provider IDs, not URL templates or YouTube handles.
  const canonical =
    siteName === "deezer"
      ? `https://www.deezer.com/artist/${encodeURIComponent(value)}`
      : siteName === "youtubechannel"
        ? `https://www.youtube.com/channel/${encodeURIComponent(value)}`
        : null;
  const candidate = canonical ?? row?.appStringFormat?.replace("%@", value);
  let profileUrl: string | null = null;
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") profileUrl = candidate;
    } catch {
      // A urlmap placeholder must not become a relative profile link.
    }
  }
  return { displayName, logoUrl, colorHex, profileUrl };
}
