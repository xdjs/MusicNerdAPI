import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import { isReservedHandle } from "@/lib/artists/isReservedHandle";
import type { RelevanceVerdict } from "@/lib/relevance/types";
import { classifyFetchedSource } from "@/lib/sources/classifyFetchedSource";
import { accountMatchFor } from "@/lib/vault/accountMatchFor";
import { adoptJudgedAccount } from "@/lib/vault/adoptJudgedAccount";
import { ACCOUNT_PLATFORMS } from "@/lib/vault/const";
import { saveCandidateSource } from "@/lib/vault/saveCandidateSource";
import type { ReadCandidate, SearchRun } from "@/lib/vault/types";

/**
 * Decides what one page we read is. An affirmed account goes to links. A
 * page's outbound links are held for the hub pass, unless it's an index,
 * because a label roster would corroborate a labelmate. An account page is
 * identity, never press, so an unadopted one becomes a candidate handle. A
 * page about someone else is dropped, and an index page's links are
 * harvested for following. Everything else is filed as a source.
 *
 * @param run - The run; its candidates, links and counts are updated.
 * @param candidate - The search hit and its page.
 * @param verdict - The judge's verdict on the page.
 * @returns "stop" when the run is out of time.
 */
export async function fileCandidate(
  run: SearchRun,
  candidate: ReadCandidate,
  verdict: RelevanceVerdict | undefined,
): Promise<"stop" | void> {
  const { result, page } = candidate;
  // Community-edited homepage relations must clear relevance before source or outbound adoption.
  if (
    result.type === "website" &&
    (verdict !== "about-artist" ||
      classifyFetchedSource(page, run.artistName, { identityConfirmed: true }) !== "verified")
  ) {
    run.counts.dropped++;
    return;
  }
  // A release URL must never be mistaken for an account by a loose legacy urlmap row.
  const release = parseMusicDestination(result.url)?.kind === "release";
  const { match, isAccountUrl } = release
    ? { match: undefined, isAccountUrl: false }
    : await accountMatchFor(result.url);
  if (isAccountUrl && match && (await adoptJudgedAccount(run, match, result.url, verdict))) {
    run.counts.skipped++;
    return;
  }
  if ((page.outboundLinks?.length ?? 0) > 0 && verdict !== "lists-artist") {
    run.hubCandidates.push({
      links: page.outboundLinks!,
      url: result.url,
      aboutArtist: verdict === "about-artist",
    });
  }
  if (match?.siteName && ACCOUNT_PLATFORMS.has(match.siteName)) {
    // Searching their name and getting back an account page is evidence
    // about whose account it is, so it's verified after the loop.
    if (match.id && !isReservedHandle(match.siteName, String(match.id))) {
      run.accountCandidates.push({
        siteName: match.siteName,
        id: String(match.id),
        url: result.url,
        title: page.title ?? "",
        description: page.snippet ?? "",
      });
    }
    run.counts.skipped++;
    return;
  }
  if (verdict === "not-about-artist") {
    console.log(
      `[vaultWebSearch] Judge: not about "${run.artistName}" — ${result.url.slice(0, 100)}`,
    );
    run.counts.dropped++;
    return;
  }
  if (verdict === "lists-artist") {
    console.log(
      `[vaultWebSearch] Judge: index/directory page, not coverage — ${result.url.slice(0, 100)}`,
    );
    for (const link of page.links ?? []) run.indexLinks.add(link);
    run.counts.dropped++;
    return;
  }
  return saveCandidateSource(run, candidate, verdict);
}
