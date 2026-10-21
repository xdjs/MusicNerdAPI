import { resolveArtistMapping } from "@/lib/mcp/resolveArtistMapping";
import type { ResolveBatchResult, ResolveItem } from "@/lib/mcp/types";

/**
 * Resolves many mappings one after another, each on its own; a failure is
 * recorded on its item and never rolls back the others.
 *
 * @param items - The mappings.
 * @param apiKeyHash - The reporting key's hash.
 * @returns One result per item, in order.
 */
export async function resolveArtistMappingBatch(
  items: ResolveItem[],
  apiKeyHash: string,
): Promise<{ results: ResolveBatchResult[] }> {
  const results: ResolveBatchResult[] = [];

  for (const item of items) {
    try {
      const result = await resolveArtistMapping({ ...item, apiKeyHash });
      results.push({ artistId: item.artistId, ...result });
    } catch (err: unknown) {
      results.push({
        artistId: item.artistId,
        created: false,
        updated: false,
        skipped: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { results };
}
