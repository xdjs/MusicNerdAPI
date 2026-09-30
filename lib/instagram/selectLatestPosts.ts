import { LATEST_POST_LIMIT, LATEST_WINDOW_MS } from "@/lib/latest/const";
import type { SocialPostInsert } from "@/lib/instagram/types";

/**
 * The posts an Update Latest check stores: the artist's own, from the last
 * thirty days, at most nine.
 *
 * @param rows - Mapped posts, newest first as Apify returns them.
 * @returns The posts to store.
 */
export function selectLatestPosts(rows: SocialPostInsert[]): SocialPostInsert[] {
  const since = Date.now() - LATEST_WINDOW_MS;
  return rows
    .filter(row => row.isOwnPost && row.postedAt && Date.parse(String(row.postedAt)) >= since)
    .slice(0, LATEST_POST_LIMIT);
}
