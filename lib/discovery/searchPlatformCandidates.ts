import { HANDLE_BASED_PLATFORM_DOMAINS, WEB_SEARCH_MAX_RESULTS } from "@/lib/discovery/const";
import { resultPassesNameCheck } from "@/lib/discovery/resultPassesNameCheck";
import type { TierCandidate } from "@/lib/discovery/types";
import type { ProfileDisplayColumn } from "@/lib/links/types";
import { webSearch } from "@/lib/search/webSearch";

/**
 * One tier-4 search on a platform's own domain. Every result that passes the
 * name check is kept, in rank order: the top hit is often a fan page, so the
 * caller tries each until one clears validation.
 *
 * @param platform - The platform to search.
 * @param query - The search query.
 * @param artistName - The resolved name.
 * @returns The candidates; never throws.
 */
export async function searchPlatformCandidates(
  platform: ProfileDisplayColumn,
  query: string,
  artistName: string,
): Promise<TierCandidate[]> {
  const domain = HANDLE_BASED_PLATFORM_DOMAINS[platform]!;
  try {
    const results = await webSearch(query, {
      includeDomains: [domain],
      maxResults: WEB_SEARCH_MAX_RESULTS,
    });
    const out: TierCandidate[] = [];
    for (const result of results) {
      if (typeof result?.url !== "string" || !result.url.startsWith("https://")) continue;
      if (!(await resultPassesNameCheck(result, platform, artistName))) continue;
      out.push({
        tier: 4,
        platform,
        url: result.url,
        reasoning: `Web search hit on ${domain}: "${result.title || result.snippet}"`,
      });
    }
    return out;
  } catch (e) {
    console.error(`[profileDiscovery] tier4 (${platform}) web search failed:`, e);
    return [];
  }
}
