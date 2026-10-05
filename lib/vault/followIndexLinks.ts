import { fetchPageContent } from "@/lib/pages/fetchPageContent";
import type { PageContent } from "@/lib/pages/types";
import { judgeSourceRelevance } from "@/lib/relevance/judgeSourceRelevance";
import type { ArtistAnchor } from "@/lib/relevance/types";
import { isBlockedSourceHost } from "@/lib/sources/isBlockedSourceHost";
import { isExcludedLoreDiscoveryUrl } from "@/lib/sources/isExcludedLoreDiscoveryUrl";
import { inferTypeFromUrl } from "@/lib/sources/inferTypeFromUrl";
import { getFetchedSourceUrl } from "@/lib/sources/getFetchedSourceUrl";
import { normalizeLoreDiscoveryUrl } from "@/lib/sources/normalizeLoreDiscoveryUrl";
import { isUnsafeUrl } from "@/lib/pages/isUnsafeUrl";
import { isMusicSource } from "@/lib/musicLinks/isMusicSource";
import { nameIsAmbiguousInDirectory } from "@/lib/identity/nameIsAmbiguousInDirectory";
import { MAX_INDEX_FOLLOWS, VERIFY_TIMEOUT_MS } from "@/lib/vault/const";
import { insertVaultSource } from "@/lib/vault/insertVaultSource";
import { isArtistOwnDomain } from "@/lib/vault/isArtistOwnDomain";
import { outOfBudget } from "@/lib/vault/outOfBudget";
import type { SearchRun } from "@/lib/vault/types";
import { recordSavedSource } from "@/lib/vault/recordSavedSource";

/**
 * Follows links out of index pages: an artist's tag archive leads to coverage
 * that the index itself isn't. At most `MAX_INDEX_FOLLOWS`, and each page is
 * judged like any other candidate. Being reached from their tag page is a
 * lead, never a verdict.
 *
 * @param run - The run; saved sources are appended.
 * @param anchor - What we know about the artist, for the judge.
 * @returns Nothing. Throws for a durable run out of time or on a failed write.
 */
export async function followIndexLinks(run: SearchRun, anchor: ArtistAnchor): Promise<void> {
  const toFollow = [...run.indexLinks]
    .filter(
      u =>
        !run.existingUrls.has(normalizeLoreDiscoveryUrl(u)) &&
        !isExcludedLoreDiscoveryUrl(u) &&
        !isUnsafeUrl(u),
    )
    .slice(0, MAX_INDEX_FOLLOWS);
  if (toFollow.length === 0 || outOfBudget(run, "index following")) return;
  console.log(`[vaultWebSearch] Following ${toFollow.length} link(s) out of index page(s)`);
  const followed = await Promise.all(
    toFollow.map(async url => {
      try {
        const page = await fetchPageContent(url, { timeoutMs: VERIFY_TIMEOUT_MS });
        const finalUrl = getFetchedSourceUrl(url, page);
        return finalUrl ? { url: finalUrl, page } : null;
      } catch {
        return null;
      }
    }),
  );
  const seen = new Set(run.existingUrls);
  const readable = followed.filter((f): f is { url: string; page: PageContent } => {
    if (!f || (f.page.fullText?.length ?? 0) === 0) return false;
    const key = normalizeLoreDiscoveryUrl(f.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (readable.length === 0 || outOfBudget(run, "followed-page judging")) return;
  const verdicts = await judgeSourceRelevance(
    anchor,
    readable.map(({ url, page }) => ({
      url,
      title: page.title,
      text: page.fullText ?? page.extractedText,
      ownDomain: isArtistOwnDomain(url, run.artistName),
    })),
  );
  for (const { url, page } of readable) {
    if (outOfBudget(run, "followed-source insertion")) break;
    if (isBlockedSourceHost(url)) {
      console.log(`[vaultWebSearch] Blocked host, not a source: ${url.slice(0, 100)}`);
      continue;
    }
    if (verdicts.get(url) !== "about-artist") {
      console.log(
        `[vaultWebSearch] Followed link is not about "${run.artistName}" — ${url.slice(0, 90)}`,
      );
      continue;
    }
    const type = page.podcastEpisode?.podcastEpisodeKey ? "audio" : inferTypeFromUrl(url);
    if (
      isMusicSource({ url, type, podcastEpisodeKey: page.podcastEpisode?.podcastEpisodeKey }) &&
      (await nameIsAmbiguousInDirectory(run.artistId, run.artistName))
    )
      continue;
    if (outOfBudget(run, "followed-source insertion")) break;
    try {
      const source = await insertVaultSource({
        artistId: run.artistId,
        url,
        title: page.title,
        snippet: page.snippet ?? "",
        type,
        status: "pending",
        extractedText: page.extractedText,
        ogImage: page.ogImage ?? null,
        ...page.podcastEpisode,
        publishedAt: page.publishedAt ?? null,
      });
      if (source) {
        run.existingUrls.add(normalizeLoreDiscoveryUrl(url));
        recordSavedSource(run, source);
        console.log(`[vaultWebSearch] Recovered from index: ${page.title?.slice(0, 70)}`);
      }
    } catch (e) {
      console.error("[vaultWebSearch] Failed to insert followed source:", url, e);
      if (run.requireComplete) throw e;
    }
  }
}
