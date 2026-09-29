import { judgeSourceRelevance } from "@/lib/relevance/judgeSourceRelevance";
import type { ArtistAnchor, RelevanceVerdict } from "@/lib/relevance/types";
import { isArtistOwnDomain } from "@/lib/vault/isArtistOwnDomain";
import type { ReadCandidate } from "@/lib/vault/types";

/**
 * Asks the relevance judge about every page we read, once for the batch. The
 * judge never rejects on failure: an unavailable judge leaves everything
 * `undecided` and the name check decides, as before the judge existed.
 *
 * @param anchor - What we know about the artist.
 * @param read - The pages, with the search hits they came from.
 * @returns The verdict per candidate URL.
 */
export async function judgeCandidates(
  anchor: ArtistAnchor,
  read: ReadCandidate[],
): Promise<Map<string, RelevanceVerdict>> {
  return judgeSourceRelevance(
    anchor,
    read.map(({ result, page }) => ({
      url: result.url,
      title: page.title ?? result.title,
      text: page.fullText ?? page.extractedText,
      ownDomain: isArtistOwnDomain(result.url, anchor.name),
    })),
  );
}
