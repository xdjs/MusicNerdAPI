import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistIdMappings, artists } from "@/lib/db/schema";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";

/**
 * Every cross-platform id mapping for an artist, by platform. One query: the
 * foreign key means any row implies the artist exists, so the artist table is
 * only checked when there are none.
 *
 * @param artistId - The artist.
 * @returns The mappings; throws MappingNotFoundError for an unknown artist.
 */
export async function getArtistMappings(artistId: string) {
  const mappings = await db.query.artistIdMappings.findMany({
    where: eq(artistIdMappings.artistId, artistId),
    orderBy: [asc(artistIdMappings.platform)],
    columns: {
      id: true,
      platform: true,
      platformId: true,
      confidence: true,
      source: true,
      reasoning: true,
      resolvedAt: true,
    },
  });

  if (mappings.length === 0) {
    const artist = await db.query.artists.findFirst({
      where: eq(artists.id, artistId),
      columns: { id: true },
    });
    if (!artist) {
      throw new MappingNotFoundError(`Artist not found: ${artistId}`);
    }
  }

  return mappings;
}
