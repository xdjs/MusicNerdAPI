import type { DiscoveredProfile } from "@/lib/discovery/types";
import { buildLinkPresentationMeta } from "@/lib/links/buildLinkPresentationMeta";
import type { UrlmapPresentationRow } from "@/lib/links/types";

/**
 * The link columns the source search filled or changed on the artist's row
 * (MusicBrainz, the artist's own page, search results), presented the way
 * discovery presents a profile, so the research view can add them to its
 * profile cards. A column with no profile URL is left out, as is anything
 * either read failed on.
 *
 * @param before - The artist row before the search, or undefined if the read failed.
 * @param after - The artist row after the search, or undefined if the read failed.
 * @param urlmap - The platform templates.
 * @returns One profile per filled or changed link column.
 */
export function adoptedProfiles(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  urlmap: (UrlmapPresentationRow & { siteName: string })[],
): DiscoveredProfile[] {
  if (!before || !after) return [];
  return urlmap.flatMap(row => {
    const value = after[row.siteName];
    if (typeof value !== "string" || !value || value === before[row.siteName]) return [];
    const meta = buildLinkPresentationMeta(row, row.siteName, value);
    if (!meta.profileUrl) return [];
    return [
      {
        siteName: row.siteName,
        displayName: meta.displayName,
        value,
        profileUrl: meta.profileUrl,
        logoUrl: meta.logoUrl,
        colorHex: meta.colorHex,
        previewImage: null,
        reasoning: null,
        // Found by the search with evidence, not built from the name.
        provisional: false,
      },
    ];
  });
}
