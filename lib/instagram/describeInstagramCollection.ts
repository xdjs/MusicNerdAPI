import type { SocialPostInsert } from "./types";
import type { SocialScan } from "@/lib/socialRefresh/types";
import { assessSocialScan } from "@/lib/socialRefresh/assessSocialScan";

/** A no-new-posts observation requires readable own posts and saved-anchor continuity. */
export function describeInstagramCollection(rows: SocialPostInsert[], scan?: SocialScan) {
  const own = rows.filter(row => row.isOwnPost);
  const valid =
    own.length > 0 &&
    own.length === rows.length &&
    own.every(
      row =>
        row.postedAt &&
        Number.isFinite(Date.parse(row.postedAt)) &&
        Date.parse(row.postedAt) <= Date.now(),
    );
  const newestPostAt = valid
    ? own.map(row => row.postedAt!).sort((a, b) => Date.parse(b) - Date.parse(a))[0]
    : undefined;
  const connected =
    valid &&
    scan &&
    assessSocialScan(
      scan,
      own.map(row => ({
        id: row.platformPostId,
        postedAt: row.postedAt!,
        pinned: (row.raw as Record<string, unknown> | null)?.isPinned === true,
      })),
      true,
    ).connected;
  return {
    ...(newestPostAt ? { newestPostAt } : {}),
    noNewPosts: !!(
      connected &&
      newestPostAt &&
      scan?.reference &&
      Date.parse(newestPostAt) <= Date.parse(scan.reference.observedAt)
    ),
  };
}
