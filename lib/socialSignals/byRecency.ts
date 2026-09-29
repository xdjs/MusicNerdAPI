import type { SocialPostRow } from "@/lib/instagram/types";

/**
 * Sort comparator: most recent first, undated posts last.
 *
 * @param a - One post.
 * @param b - Another post.
 * @returns A negative number when `a` is newer.
 */
export function byRecency(a: SocialPostRow, b: SocialPostRow): number {
  return (Date.parse(b.postedAt || "") || 0) - (Date.parse(a.postedAt || "") || 0);
}
