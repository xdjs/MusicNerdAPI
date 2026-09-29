import { fetchPageContent } from "@/lib/pages/fetchPageContent";
import { podcastService } from "@/lib/sources/podcastService";
import { updateVaultSourceContent } from "@/lib/vault/updateVaultSourceContent";

/**
 * Reads a pasted source's page and fills in its title, snippet, text and
 * image, so the Lore isn't left with a bare URL. Runs in the background, as in
 * MusicNerdWeb, except for a podcast episode, whose identity the page must set
 * before the turn goes on. Never throws.
 *
 * @param sourceId - The vault source just inserted.
 * @param url - Its URL.
 * @param opts - What to keep.
 * @param opts.keepTitle - Keep the title we already have (a real og:title) rather than the page read's.
 * @returns When a podcast episode is enriched, or at once for anything else.
 */
export async function enrichVaultSource(
  sourceId: string,
  url: string,
  opts: { keepTitle: boolean },
): Promise<void> {
  const enrichment = fetchPageContent(url)
    .then(content =>
      updateVaultSourceContent(sourceId, {
        ...content.podcastEpisode,
        ...(opts.keepTitle ? {} : { title: content.title }),
        snippet: content.snippet,
        extractedText: content.extractedText,
        ogImage: content.ogImage,
      }),
    )
    .catch(e => console.error("[onboarding] Content enrichment failed:", e));
  if (podcastService(url)) await enrichment;
}
