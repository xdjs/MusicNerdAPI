import { sql } from "drizzle-orm";
import { ProviderIdentityConflictError } from "@/lib/artistSearch/ProviderIdentityConflictError";
import type { ArtistSearchRow } from "@/lib/artistSearch/types";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { MusicPlatform } from "@/lib/musicPlatform/types";

/** Resolve exact saved ownership using the public projection; contradictory ownership is a conflict. */
export async function searchForArtistByProviderId(
  platform: MusicPlatform,
  platformId: string,
): Promise<ArtistSearchRow[]> {
  const column = platform === "spotify" ? sql`spotify` : sql`deezer`;
  const rows = rowsOf(
    await db.execute(sql`
    SELECT id, name, spotify, deezer, bandcamp, youtube, youtubechannel,
      instagram, x, facebook, tiktok, custom_image AS "customImage", 0 AS match_type,
      EXISTS (
        SELECT 1 FROM artist_id_mappings conflicting_mapping
        WHERE conflicting_mapping.artist_id = artists.id
          AND conflicting_mapping.platform = ${platform}
          AND conflicting_mapping.platform_id <> ${platformId}
      ) AS "hasConflictingMapping"
    FROM artists
    WHERE ${column} = ${platformId}
      OR EXISTS (
        SELECT 1 FROM artist_id_mappings mapping
        WHERE mapping.artist_id = artists.id
          AND mapping.platform = ${platform}
          AND mapping.platform_id = ${platformId}
      )
    ORDER BY id
  `),
  ) as (ArtistSearchRow & { hasConflictingMapping: boolean })[];
  if (
    rows.length > 1 ||
    rows.some(
      row => row.hasConflictingMapping || (row[platform]?.trim() && row[platform] !== platformId),
    )
  )
    throw new ProviderIdentityConflictError();
  return rows.map(({ hasConflictingMapping: _hasConflictingMapping, ...artist }) => artist);
}
