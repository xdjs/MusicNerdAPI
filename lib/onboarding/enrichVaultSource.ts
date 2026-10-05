import { fetchPageContent } from "@/lib/pages/fetchPageContent";
import { podcastService } from "@/lib/sources/podcastService";
import { updateVaultSourceContent } from "@/lib/vault/updateVaultSourceContent";

/**
 * Awaits podcast identity metadata needed by the next onboarding turn.
 * Original body collection belongs to durable approved-source jobs. Never throws.
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
  if (!podcastService(url)) return;
  await fetchPageContent(url)
    .then(content =>
      updateVaultSourceContent(sourceId, {
        ...content.podcastEpisode,
        ...(opts.keepTitle ? {} : { title: content.title }),
        snippet: content.snippet,
        ogImage: content.ogImage,
      }),
    )
    .catch(e => console.error("[onboarding] Content enrichment failed:", e));
}
