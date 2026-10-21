import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { VALID_MAPPING_PLATFORMS } from "@/lib/mcp/const";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";

type UnmappedArtist = {
  id: string;
  name: string | null;
  spotify: string | null;
  deezer: string | null;
};

/**
 * Artists that hold a Spotify (or Deezer) id and have neither a mapping nor an
 * exclusion for `platform`, in a daily-shuffled order so parallel workers
 * don't all start on the same artists.
 *
 * @param platform - The target platform.
 * @param limit - Page size.
 * @param offset - Page offset.
 * @param basePlatform - Which id the source artists must hold.
 * @returns The page and the total still unmapped.
 */
export async function getUnmappedArtists(
  platform: string,
  limit: number,
  offset: number,
  basePlatform: "spotify" | "deezer" = "spotify",
): Promise<{ artists: UnmappedArtist[]; totalUnmapped: number }> {
  if (!VALID_MAPPING_PLATFORMS.has(platform)) {
    throw new MappingValidationError(`Invalid platform: ${platform}`);
  }

  const baseFilter =
    basePlatform === "deezer" ? sql`a.deezer IS NOT NULL` : sql`a.spotify IS NOT NULL`;

  const [countResult, result] = await Promise.all([
    db.execute<{ total: number }>(sql`
      SELECT COUNT(*)::int AS total
      FROM artists a
      WHERE ${baseFilter}
        AND NOT EXISTS (
          SELECT 1 FROM artist_id_mappings m
          WHERE m.artist_id = a.id AND m.platform = ${platform}
        )
        AND NOT EXISTS (
          SELECT 1 FROM artist_mapping_exclusions e
          WHERE e.artist_id = a.id AND e.platform = ${platform}
        )
    `),
    db.execute<UnmappedArtist>(sql`
      SELECT a.id, a.name, a.spotify, a.deezer
      FROM artists a
      WHERE ${baseFilter}
        AND NOT EXISTS (
          SELECT 1 FROM artist_id_mappings m
          WHERE m.artist_id = a.id AND m.platform = ${platform}
        )
        AND NOT EXISTS (
          SELECT 1 FROM artist_mapping_exclusions e
          WHERE e.artist_id = a.id AND e.platform = ${platform}
        )
      ORDER BY MD5(a.id || CURRENT_DATE::text)
      LIMIT ${limit} OFFSET ${offset}
    `),
  ]);

  return {
    artists: [...result],
    totalUnmapped: countResult[0]?.total ?? 0,
  };
}
