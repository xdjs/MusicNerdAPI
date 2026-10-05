import { fetchPageContent } from "@/lib/pages/fetchPageContent";
import { getFetchedSourceUrl } from "@/lib/sources/getFetchedSourceUrl";
import { inferTypeFromUrl } from "@/lib/sources/inferTypeFromUrl";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import { VERIFY_TIMEOUT_MS } from "@/lib/vault/const";
import type { DiscoveryResult, ReadCandidate } from "@/lib/vault/types";

/**
 * Fetches every candidate in parallel before anything is written. A search hit
 * is a claim about a page, not the page: it can be dead, paywalled or about a
 * namesake. A URL that redirects to LinkedIn (a login or bot wall) is dropped
 * here, before the judge or any adoption sees it.
 *
 * @param candidates - The filtered candidates.
 * @returns Each candidate with its fetched page.
 */
export async function readCandidates(candidates: DiscoveryResult[]): Promise<ReadCandidate[]> {
  const read = await Promise.all(
    candidates.map(async (result): Promise<ReadCandidate | null> => {
      const page = await fetchPageContent(result.url, { timeoutMs: VERIFY_TIMEOUT_MS });
      const url = getFetchedSourceUrl(result.url, page);
      if (!url) return null;
      if (url === result.url) return { result, page };
      return {
        result: {
          ...result,
          url,
          type:
            result.type === "website" && !parseMusicDestination(url)
              ? "website"
              : inferTypeFromUrl(url),
        },
        page,
        discoveredUrl: result.url,
      };
    }),
  );
  return read.filter((candidate): candidate is ReadCandidate => candidate !== null);
}
