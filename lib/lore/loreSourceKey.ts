import type { LoreSummarySource } from "@/lib/lore/types";

/**
 * A key for the approved-source inventory a Lore summary describes. MusicNerdWeb
 * shows a stored summary only while this key still matches, so a removed,
 * renamed or reclassified source hides it at once. Inventory metadata only.
 *
 * @param sources - The approved sources.
 * @returns The key, independent of source order.
 */
export function loreSourceKey(sources: LoreSummarySource[]): string {
  return JSON.stringify(
    sources
      .map(source => [source.id, source.title ?? "", source.type ?? "article"])
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
}
