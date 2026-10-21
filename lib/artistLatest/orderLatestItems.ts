import { latestActivityTime } from "@/lib/latestProviders/latestActivityTime";

/**
 * Latest cards newest first, without undated or future-dated cards or repeated
 * ids. Ported from MusicNerdWeb's `orderLatestItems`, which its profile feed
 * applied to every artist's Latest.
 *
 * @param items - The cards.
 * @param now - The current time in milliseconds.
 * @returns The kept cards, newest first, ties by id.
 */
export function orderLatestItems<T extends { id: string; date: string }>(
  items: T[],
  now = Date.now(),
): T[] {
  const seen = new Set<string>();
  return items
    .filter(item => {
      const date = latestActivityTime(item.date);
      if (!Number.isFinite(date) || date > now || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort(
      (a, b) => latestActivityTime(b.date) - latestActivityTime(a.date) || a.id.localeCompare(b.id),
    );
}
