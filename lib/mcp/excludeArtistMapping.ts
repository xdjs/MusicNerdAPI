import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistMappingExclusions, artists } from "@/lib/db/schema";
import { VALID_EXCLUSION_REASONS, VALID_MAPPING_PLATFORMS } from "@/lib/mcp/const";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";
import type { ExclusionReason } from "@/lib/mcp/types";

/**
 * Marks an artist as excluded from future mapping batches for a platform, one
 * row per artist and platform; a repeat replaces the reason, details and key
 * (an omitted one becomes null).
 *
 * @param params - The exclusion and the reporting key's hash.
 * @returns Whether the row was created or updated (Postgres' xmax is 0 on an insert).
 */
export async function excludeArtistMapping(params: {
  artistId: string;
  platform: string;
  reason: ExclusionReason;
  details?: string;
  apiKeyHash?: string;
}): Promise<{ created: boolean; updated: boolean }> {
  const { artistId, platform, reason, details, apiKeyHash } = params;

  if (!VALID_MAPPING_PLATFORMS.has(platform)) {
    throw new MappingValidationError(`Invalid platform: ${platform}`);
  }
  if (!VALID_EXCLUSION_REASONS.has(reason)) {
    throw new MappingValidationError(`Invalid exclusion reason: ${reason}`);
  }

  const artist = await db.query.artists.findFirst({
    where: eq(artists.id, artistId),
    columns: { id: true },
  });
  if (!artist) {
    throw new MappingNotFoundError(`Artist not found: ${artistId}`);
  }

  const result = await db
    .insert(artistMappingExclusions)
    .values({
      artistId,
      platform,
      reason,
      details: details ?? null,
      apiKeyHash: apiKeyHash ?? null,
    })
    .onConflictDoUpdate({
      target: [artistMappingExclusions.artistId, artistMappingExclusions.platform],
      set: {
        reason: sql`excluded.reason`,
        details: sql`excluded.details`,
        apiKeyHash: sql`excluded.api_key_hash`,
      },
    })
    .returning({ xmax: sql<string>`xmax::text` });

  const wasInsert = result[0]?.xmax === "0";
  return { created: wasInsert, updated: !wasInsert };
}
