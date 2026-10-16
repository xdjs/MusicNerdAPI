import { webSearch } from "@/lib/search/webSearch";
import type { WebSearchResult } from "@/lib/search/types";
import { TAVILY_RESULTS_PER_QUERY } from "@/lib/vault/const";
import { holdsAnswerFor } from "@/lib/vault/holdsAnswerFor";
import type { SearchRun } from "@/lib/vault/types";

/**
 * Retrieves channel candidates only when neither YouTube slot has a saved answer.
 * Tavily's path filters keep videos from consuming the five-result channel budget;
 * returned hits still need the normal fetched-page and account ownership checks.
 * Logs only bounded YouTube paths so a retrieval miss can be distinguished from
 * a later verification rejection without logging page contents or query secrets.
 *
 * @param run - Current artist identity, provisional slots and failure policy.
 * @returns Untrusted search candidates, or none when YouTube is already saved.
 */
export async function searchMissingYouTubeChannels(run: SearchRun): Promise<WebSearchResult[]> {
  if (
    ["youtube", "youtubechannel"].some(site => holdsAnswerFor(run.artist, site, run.provisional))
  ) {
    return [];
  }
  const hits = await webSearch(`${run.artistName} official YouTube channel`, {
    // Tavily documents path filters: https://docs.tavily.com/documentation/best-practices/best-practices-search
    includeDomains: ["youtube.com/@", "youtube.com/channel/"],
    maxResults: TAVILY_RESULTS_PER_QUERY,
    ...(run.requireComplete ? { throwOnError: true } : {}),
  });
  const paths = hits.slice(0, TAVILY_RESULTS_PER_QUERY).map(hit => {
    try {
      const url = new URL(hit.url);
      return ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
        ? url.pathname.slice(0, 160)
        : "unexpected_host";
    } catch {
      return "invalid_url";
    }
  });
  console.log(
    `[vaultWebSearch] Missing YouTube search returned ${hits.length} results; paths=${JSON.stringify(paths)}`,
  );
  return hits;
}
