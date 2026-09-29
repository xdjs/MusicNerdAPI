import type { SocialPostRow } from "@/lib/instagram/types";
import { byRecency } from "@/lib/socialSignals/byRecency";
import { MIN_POSTS_FOR_SIGNALS, RECENT_WINDOW_DAYS } from "@/lib/socialSignals/const";

/**
 * The posts to derive signals from: everything inside the recency window, or
 * the whole history, newest first, when the window is thinner than
 * `MIN_POSTS_FOR_SIGNALS`. The window stops old posts crowding out new ones;
 * it does not throw away a rare poster's history.
 *
 * @param posts - The artist's stored posts.
 * @param now - The current time in ms, for tests.
 * @returns The selected posts, newest first.
 */
export function selectRecentPosts(
  posts: SocialPostRow[],
  now: number = Date.now(),
): SocialPostRow[] {
  const sorted = [...posts].sort(byRecency);
  const cutoff = now - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const inWindow = sorted.filter(p => {
    const t = Date.parse(p.postedAt || "");
    return Number.isFinite(t) && t >= cutoff;
  });
  return inWindow.length >= MIN_POSTS_FOR_SIGNALS ? inWindow : sorted;
}
