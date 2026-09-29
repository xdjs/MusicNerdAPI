import type { DiscoveredProfile } from "@/lib/discovery/types";
import { buildLinkPresentationMeta } from "@/lib/links/buildLinkPresentationMeta";
import type { UrlmapPresentationRow } from "@/lib/links/types";
import type { TurnEvent } from "@/lib/onboarding/types";

/**
 * The two-account question that actually happens. Discovery can't produce two
 * candidates for a platform; the second comes from the source search, which
 * replaced a column discovery filled with a name-built guess. Both are real
 * accounts, so the artist is asked which is theirs instead of us picking.
 *
 * @param provisionalSiteNames - Columns discovery filled with a guess.
 * @param discoveredBySiteName - The profile discovery wrote for each platform.
 * @param after - The artist row after the search, or undefined if the read failed.
 * @param urlmap - The platform templates.
 * @returns One `choices` event per replaced guess that has a profile URL to open.
 */
export function secondAccountChoices(
  provisionalSiteNames: string[],
  discoveredBySiteName: Map<string, DiscoveredProfile>,
  after: Record<string, unknown> | undefined,
  urlmap: (UrlmapPresentationRow & { siteName: string })[],
): TurnEvent[] {
  const urlmapBySiteName = new Map(urlmap.map(l => [l.siteName, l]));
  return provisionalSiteNames.flatMap(siteName => {
    const guessed = discoveredBySiteName.get(siteName);
    const now = after?.[siteName];
    if (!guessed || typeof now !== "string" || !now || now === guessed.value) return [];
    const meta = buildLinkPresentationMeta(urlmapBySiteName.get(siteName), siteName, now);
    // Nothing to click through to: don't ask half a question.
    if (!meta.profileUrl) return [];
    return [
      {
        kind: "choices" as const,
        platform: siteName,
        chosen: now,
        options: [
          { ...guessed, value: now, profileUrl: meta.profileUrl, displayName: meta.displayName },
          guessed,
        ],
      },
    ];
  });
}
