import type { ArtistAnchor } from "@/lib/relevance/types";
import { inferTypeFromUrl } from "@/lib/sources/inferTypeFromUrl";
import { normalizeLoreDiscoveryUrl } from "@/lib/sources/normalizeLoreDiscoveryUrl";
import { accountMatchFor } from "@/lib/vault/accountMatchFor";
import { MAX_ACCOUNT_CHECKS } from "@/lib/vault/const";
import { holdsAnswerFor } from "@/lib/vault/holdsAnswerFor";
import { outOfBudget } from "@/lib/vault/outOfBudget";
import { processDiscoveryCandidates } from "@/lib/vault/processDiscoveryCandidates";
import { searchMissingYouTubeChannels } from "@/lib/vault/searchMissingYouTubeChannels";
import type { DiscoveryResult, SearchRun } from "@/lib/vault/types";
import { verifyAccountCandidates } from "@/lib/vault/verifyAccountCandidates";

/**
 * Tries at most three basic searches for a missing YouTube account, verifying
 * each round before spending the next query. Only actual returned channel URLs
 * are read here, with at most ten page reads across rounds and the shared account
 * check/deadline caps. Other page hits are returned for ordinary Lore processing.
 *
 * @param run - Shared identity and bounded discovery state.
 * @param rejectedUrls - Artist-rejected URLs, preserved by normal intake checks.
 * @param anchor - Verified identity context for the existing relevance judge.
 * @returns Non-YouTube candidates to process as normal potential sources.
 */
export async function discoverMissingYouTubeChannel(
  run: SearchRun,
  rejectedUrls: Set<string>,
  anchor: ArtistAnchor,
): Promise<DiscoveryResult[]> {
  const others: DiscoveryResult[] = [];
  const seen = new Set<string>();
  let pages = 0;
  for (const round of [0, 1, 2] as const) {
    if (
      ["youtube", "youtubechannel"].some(site => holdsAnswerFor(run.artist, site, run.provisional))
    )
      break;
    const remaining = Math.min(
      MAX_ACCOUNT_CHECKS - pages,
      MAX_ACCOUNT_CHECKS - (run.checkedAccountCandidates?.size ?? 0),
    );
    if (remaining <= 0 || outOfBudget(run, "YouTube search")) break;
    const hits = await searchMissingYouTubeChannels(run, round);
    const channels: DiscoveryResult[] = [];
    for (const hit of hits.slice(0, round === 2 ? 5 : 10)) {
      if (!hit.url || !hit.title) continue;
      const key = normalizeLoreDiscoveryUrl(hit.url);
      if (seen.has(key) || run.existingUrls.has(key) || rejectedUrls.has(key)) continue;
      seen.add(key);
      let host: string;
      try {
        host = new URL(hit.url).hostname;
      } catch {
        continue;
      }
      const result = { ...hit, type: inferTypeFromUrl(hit.url) };
      if (
        ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(
          host,
        )
      ) {
        const { match, isAccountUrl } = await accountMatchFor(hit.url);
        if (isAccountUrl && match && ["youtube", "youtubechannel"].includes(match.siteName))
          channels.push(result);
      } else {
        others.push(result);
      }
    }
    const batch = channels.slice(0, remaining);
    pages += batch.length;
    await processDiscoveryCandidates(run, batch, rejectedUrls, anchor);
    await verifyAccountCandidates(run);
    const verified = ["youtube", "youtubechannel"].some(site =>
      holdsAnswerFor(run.artist, site, run.provisional),
    );
    console.log(
      `[vaultWebSearch] Missing YouTube stage=${round + 1} outcome=${verified ? "saved" : "unverified"} channelPages=${batch.length} totalChannelPages=${pages}`,
    );
    if (verified) break;
  }
  return others;
}
