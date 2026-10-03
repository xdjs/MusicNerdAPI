import { TOP_STANDOUTS } from "@/lib/questions/const";
import { shortCodeFromUrl } from "@/lib/questions/shortCodeFromUrl";
import type { SignalCandidate } from "@/lib/questions/types";
import type { StandoutPost } from "@/lib/socialSignals/types";

/**
 * The artist's own posts that did far better than usual: the strongest
 * single-post signals, like a fundraiser or a loss.
 *
 * @param artistName - The artist.
 * @param standoutPosts - The standouts derived from the posts.
 * @returns The TOP_STANDOUTS with the highest multiple.
 */
export function standoutCandidates(
  artistName: string,
  standoutPosts: StandoutPost[],
): SignalCandidate[] {
  return [...standoutPosts]
    .sort((a, b) => b.multiple - a.multiple)
    .slice(0, TOP_STANDOUTS)
    .map(s => ({
      signalId: `standout_${shortCodeFromUrl(s.url)}`,
      kind: "standout",
      key: `social_standout_${shortCodeFromUrl(s.url)}`,
      authoredBy: "artist",
      material: `One of ${artistName}'s own posts noticeably outperformed their typical ${s.metric} on the same platform (roughly ${s.multiple}x their usual). Its caption: ${s.caption ? `"${s.caption}"` : "(no caption)"}`,
      sourceUrls: [s.url],
    }));
}
