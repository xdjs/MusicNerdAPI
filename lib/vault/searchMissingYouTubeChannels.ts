import { webSearch } from "@/lib/search/webSearch";
import type { WebSearchResult } from "@/lib/search/types";
import { holdsAnswerFor } from "@/lib/vault/holdsAnswerFor";
import type { SearchRun } from "@/lib/vault/types";

/**
 * Retrieves channel candidates only when neither YouTube slot has a saved answer.
 * Each basic query is selected by the bounded discovery orchestrator, which
 * verifies returned channel URLs before requesting a later fallback round.
 * Logs only bounded YouTube paths so a retrieval miss can be distinguished from
 * a later verification rejection without logging page contents or query secrets.
 *
 * @param run - Current artist identity, provisional slots and failure policy.
 * @param round - Unrestricted ten-result, simple ten-result or filtered five-result query.
 * @returns Untrusted search candidates, or none when YouTube is already saved.
 */
export async function searchMissingYouTubeChannels(
  run: SearchRun,
  round: 0 | 1 | 2,
): Promise<WebSearchResult[]> {
  if (
    ["youtube", "youtubechannel"].some(site => holdsAnswerFor(run.artist, site, run.provisional))
  ) {
    return [];
  }
  const stage = ["unrestricted", "simple", "filtered"][round];
  const maxResults = round === 2 ? 5 : 10;
  const query =
    round === 1 ? `"${run.artistName}" YouTube` : `${run.artistName} official YouTube channel`;
  const hits = await webSearch(query, {
    ...(round === 2 ? { includeDomains: ["youtube.com/@", "youtube.com/channel/"] } : {}),
    maxResults,
    ...(run.requireComplete ? { throwOnError: true } : {}),
  });
  const paths = hits.slice(0, maxResults).map(hit => {
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
    `[vaultWebSearch] Missing YouTube stage=${stage} returned ${hits.length} results; paths=${JSON.stringify(paths)}`,
  );
  return hits;
}
