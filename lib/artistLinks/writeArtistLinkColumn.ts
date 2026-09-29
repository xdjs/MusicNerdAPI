import { and, eq, sql } from "drizzle-orm";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { getArtistLinkValue } from "@/lib/artistLinks/getArtistLinkValue";
import type { ArtistLinkExecutor } from "@/lib/artistLinks/types";
import { artistIdMappings, artists } from "@/lib/db/schema";

/**
 * Sets one link column. A spotify or deezer id must not already be another
 * artist's, directly or through artist_id_mappings, nor differ from this
 * artist's own mapping. The bio is deliberately left alone.
 *
 * @param database - The write's transaction or client.
 * @param artistId - The artist.
 * @param columnName - A whitelisted column.
 * @param value - The new value.
 * @returns The previous value and the artist's name; throws ArtistLinkConflictError on a conflict.
 */
export async function writeArtistLinkColumn(
  database: ArtistLinkExecutor,
  artistId: string,
  columnName: string,
  value: string,
): Promise<{ oldValue: string | null; artistName: string | null }> {
  const artist = await database.query.artists.findFirst({ where: eq(artists.id, artistId) });
  if (!artist) throw new Error(`Artist not found: ${artistId}`);

  const oldValue = getArtistLinkValue(artist, columnName);
  if (columnName === "spotify" || columnName === "deezer") {
    const directColumn = columnName === "spotify" ? artists.spotify : artists.deezer;
    const [directOwner, mappingOwner, artistMapping] = await Promise.all([
      database.query.artists.findFirst({ where: eq(directColumn, value), columns: { id: true } }),
      database.query.artistIdMappings.findFirst({
        where: and(
          eq(artistIdMappings.platform, columnName),
          eq(artistIdMappings.platformId, value),
        ),
        columns: { artistId: true },
      }),
      database.query.artistIdMappings.findFirst({
        where: and(
          eq(artistIdMappings.artistId, artistId),
          eq(artistIdMappings.platform, columnName),
        ),
        columns: { platformId: true },
      }),
    ]);
    if (directOwner && directOwner.id !== artistId) {
      throw new ArtistLinkConflictError(
        `That ${columnName} artist ID is already linked to a different artist`,
      );
    }
    if (
      (mappingOwner && mappingOwner.artistId !== artistId) ||
      (artistMapping && artistMapping.platformId !== value)
    ) {
      throw new ArtistLinkConflictError(
        `That ${columnName} artist ID conflicts with an existing artist mapping`,
      );
    }
  }

  await database.execute(
    sql`UPDATE artists SET ${sql.identifier(columnName)} = ${value} WHERE id = ${artistId}`,
  );
  return { oldValue, artistName: artist.name ?? null };
}
