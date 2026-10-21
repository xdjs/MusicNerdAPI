import { excludeArtistMapping } from "@/lib/mcp/excludeArtistMapping";
import type { ExcludeBatchResult, ExcludeItem } from "@/lib/mcp/types";

/**
 * Excludes many artists one after another, each on its own; a failure is
 * recorded on its item and never rolls back the others.
 *
 * @param items - The exclusions.
 * @param apiKeyHash - The reporting key's hash.
 * @returns One result per item, in order.
 */
export async function excludeArtistMappingBatch(
  items: ExcludeItem[],
  apiKeyHash: string,
): Promise<{ results: ExcludeBatchResult[] }> {
  const results: ExcludeBatchResult[] = [];

  for (const item of items) {
    try {
      const result = await excludeArtistMapping({ ...item, apiKeyHash });
      results.push({ artistId: item.artistId, ...result });
    } catch (err: unknown) {
      results.push({
        artistId: item.artistId,
        created: false,
        updated: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { results };
}
