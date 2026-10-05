import type { SocialPostRow } from "@/lib/instagram/types";
import { scanStandouts } from "@/lib/socialSignals/scanStandouts";
import type { StandoutPost } from "@/lib/socialSignals/types";

/**
 * The artist's own posts whose likes or plays are a large multiple of their own median.
 *
 * @param posts - The posts to read.
 * @returns Standouts, highest multiple first.
 */
export function deriveStandoutPosts(posts: SocialPostRow[]): StandoutPost[] {
  const own = posts.filter(p => p.isOwnPost);
  const byUrl = new Map<string, StandoutPost>();
  for (const platform of new Set(own.map(p => p.platform))) {
    const samePlatform = own.filter(p => p.platform === platform);
    scanStandouts(samePlatform, "likes", p => p.likeCount, byUrl);
    scanStandouts(samePlatform, "plays", p => p.playCount, byUrl);
  }
  return [...byUrl.values()].sort((a, b) => b.multiple - a.multiple);
}
