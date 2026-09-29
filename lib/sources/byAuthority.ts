import { sourceAuthority } from "@/lib/sources/sourceAuthority";

/**
 * Sorts sources best-first, stably. Ties keep their order, which for the vault
 * means most recently discovered first. Nothing is dropped.
 *
 * @param items - The sources.
 * @param read - Reads the URL, type and own-site flag from one item.
 * @returns A new array, best first.
 */
export function byAuthority<T>(
  items: T[],
  read: (item: T) => { url: string; type?: string | null; ownDomain?: boolean },
): T[] {
  return items
    .map((item, i) => {
      const r = read(item);
      return { item, i, rank: sourceAuthority(r.url, r.type, { ownDomain: r.ownDomain }) };
    })
    .sort((a, b) => b.rank - a.rank || a.i - b.i)
    .map(x => x.item);
}
