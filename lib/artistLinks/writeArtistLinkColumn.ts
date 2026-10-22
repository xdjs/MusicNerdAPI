import type { CatalogWriteEvidence } from "@/lib/providerIdentity/types";
import { rowsOf } from "@/lib/db/rowsOf";
import { and, eq, sql } from "drizzle-orm";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { getArtistLinkValue } from "@/lib/artistLinks/getArtistLinkValue";
import type { ArtistLinkExecutor } from "@/lib/artistLinks/types";
import { artistIdMappings, artists } from "@/lib/db/schema";
import { cancelSpotifyMatchForIdentityEdit } from "@/lib/spotifyMatch/cancelSpotifyMatchForIdentityEdit";

/**
 * Sets one link column. A spotify or deezer id must not already be another
 * artist's, directly or through artist_id_mappings, nor differ from this
 * artist's own mapping. The bio is deliberately left alone.
 *
 * @param database - The write's transaction or client.
 * @param artistId - The artist.
 * @param columnName - A whitelisted column.
 * @param value - The new value.
 * @param evidence - Exact source and target values observed by automatic verification.
 * @returns The previous value and the artist's name; throws ArtistLinkConflictError on a conflict.
 */
export async function writeArtistLinkColumn(
  database: ArtistLinkExecutor,
  artistId: string,
  columnName: string,
  value: string,
  evidence?: CatalogWriteEvidence,
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

  if (evidence) {
    const isDeezer = "previousDeezerId" in evidence;
    if (
      columnName !== (isDeezer ? "deezer" : "spotify") ||
      value !== (isDeezer ? evidence.deezerId : evidence.spotifyId)
    )
      throw new ArtistLinkConflictError("Automatic catalog evidence does not match the write");
    const updated = rowsOf(
      await database.execute(
        isDeezer
          ? sql`
        UPDATE artists SET deezer = ${value}
        WHERE id = ${artistId} AND spotify = ${evidence.spotifyId}
          AND deezer IS NOT DISTINCT FROM ${evidence.previousDeezerId}
        RETURNING id
      `
          : sql`
        UPDATE artists SET spotify = ${value}
        WHERE id = ${artistId} AND deezer = ${evidence.deezerId}
          AND spotify IS NOT DISTINCT FROM ${evidence.previousSpotifyId}
        RETURNING id
      `,
      ),
    );
    if (updated.length !== 1)
      throw new ArtistLinkConflictError("Catalog identity changed during automatic verification");
  } else {
    await database.execute(
      sql`UPDATE artists SET ${sql.identifier(columnName)} = ${value} WHERE id = ${artistId}`,
    );
  }
  if ((columnName === "spotify" || columnName === "deezer") && oldValue !== value)
    await cancelSpotifyMatchForIdentityEdit(database, artistId);
  return { oldValue, artistName: artist.name ?? null };
}
