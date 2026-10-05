import { isMusicSource } from "@/lib/musicLinks/isMusicSource";
import { nameIsAmbiguousInDirectory } from "@/lib/identity/nameIsAmbiguousInDirectory";
import { inferTypeFromUrl } from "@/lib/sources/inferTypeFromUrl";
import type { RelevanceVerdict } from "@/lib/relevance/types";
import { classifyFetchedSource } from "@/lib/sources/classifyFetchedSource";
import { nameAppearsIn } from "@/lib/sources/nameAppearsIn";
import { normalizeSourceType } from "@/lib/sources/normalizeSourceType";
import { insertVaultSource } from "@/lib/vault/insertVaultSource";
import { isArtistOwnDomain } from "@/lib/vault/isArtistOwnDomain";
import { outOfBudget } from "@/lib/vault/outOfBudget";
import type { ReadCandidate, SearchRun } from "@/lib/vault/types";
import { recordSavedSource } from "@/lib/vault/recordSavedSource";

/**
 * Files a page as a vault source, or drops it. A page must name the artist in
 * full unless it's their own domain or the judge affirmed it, so a namesake
 * article stays an uncitable lead. A page we couldn't read is only as good as
 * its search title, which then has to name the artist in full. The extracted
 * text is stored only for a verified page: it's the verification record.
 *
 * @param run - The run; saved sources and counts are updated.
 * @param candidate - The search hit and its page.
 * @param verdict - The judge's verdict on the page.
 * @returns "stop" when out of time before inserting. Throws a failed write for a durable run.
 */
export async function saveCandidateSource(
  run: SearchRun,
  { result, page }: ReadCandidate,
  verdict: RelevanceVerdict | undefined,
): Promise<"stop" | void> {
  const music = isMusicSource({
    ...result,
    podcastEpisodeKey: page.podcastEpisode?.podcastEpisodeKey,
  });
  if (
    music &&
    (verdict !== "about-artist" || (await nameIsAmbiguousInDirectory(run.artistId, run.artistName)))
  ) {
    run.counts.dropped++;
    return;
  }
  // Some feeds are served from ordinary-looking URLs.
  const body = (page.fullText ?? page.extractedText ?? "").trimStart();
  if (body.startsWith("<?xml") || body.startsWith("<rss")) {
    console.log(`[vaultWebSearch] Skipping XML document: ${result.url.slice(0, 100)}`);
    run.counts.dropped++;
    return;
  }
  const classified = classifyFetchedSource(page, run.artistName, {
    requireFullName: !isArtistOwnDomain(result.url, run.artistName),
    identityConfirmed: verdict === "about-artist",
  });
  const unreadable =
    classified === "lead" && (!page.extractedText || page.extractedText.trim().length < 200);
  if (unreadable) {
    const evidence = `${result.title ?? ""} ${result.snippet ?? ""}`;
    if (!nameAppearsIn(evidence, run.artistName, { requireFullName: true })) {
      console.log(
        `[vaultWebSearch] Unreadable and its title is not about "${run.artistName}", dropping: ${String(result.title ?? result.url).slice(0, 70)}`,
      );
      run.counts.dropped++;
      return;
    }
  }
  if (classified === "dead") {
    console.warn(
      `[vaultWebSearch] Dropping unreachable/irrelevant URL (status ${page.status}): ${result.url.slice(0, 120)}`,
    );
    run.counts.dropped++;
    return;
  }
  const isVerified = classified === "verified";
  if (result.type === "website" && !isVerified) {
    run.counts.dropped++;
    return;
  }
  try {
    if (outOfBudget(run, "source insertion")) return "stop";
    const source = await insertVaultSource({
      artistId: run.artistId,
      url: result.url,
      // The page is the authority on its own title and description.
      title: (isVerified ? page.title : null) ?? result.title,
      snippet: (isVerified ? page.snippet : undefined) ?? result.snippet ?? "",
      type: music
        ? "music"
        : verdict === "about-artist" && isArtistOwnDomain(result.url, run.artistName)
          ? "website"
          : inferTypeFromUrl(result.url) === "data"
            ? "data"
            : normalizeSourceType(result.type ?? "article"),
      status: "pending",
      extractedText: isVerified ? page.extractedText : null,
      ogImage: page.ogImage ?? null,
      ...(isVerified ? page.podcastEpisode : null),
      publishedAt: page.publishedAt ?? null,
    });
    if (source) recordSavedSource(run, source);
  } catch (e) {
    console.error("[vaultWebSearch] Failed to insert source:", result.url, e);
    if (run.requireComplete) throw e;
  }
}
