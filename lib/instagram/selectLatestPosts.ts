import { LATEST_POST_LIMIT, LATEST_WINDOW_MS } from "@/lib/latest/const";
import type { SocialPostInsert } from "@/lib/instagram/types";

/**
 * Select at most nine dated own posts. Latest's bounded account scans may
 * retain older results; legacy callers keep their thirty-day filter.
 *
 * @param rows - Mapped posts, newest first as Apify returns them.
 * @param includeOlder - Keep older dated posts from a bounded account scan.
 * @returns The posts to store.
 */
export function selectLatestPosts(
  rows: SocialPostInsert[],
  includeOlder = false,
): SocialPostInsert[] {
  const since = Date.now() - LATEST_WINDOW_MS;
  return rows
    .filter(
      row =>
        row.isOwnPost &&
        row.postedAt &&
        Number.isFinite(Date.parse(String(row.postedAt))) &&
        Date.parse(String(row.postedAt)) <= Date.now() &&
        (includeOlder || Date.parse(String(row.postedAt)) >= since),
    )
    .slice(0, LATEST_POST_LIMIT);
}
