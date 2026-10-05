import { sql } from "drizzle-orm";
import { rowsOf } from "@/lib/db/rowsOf";
import type { ScopedWriteDb } from "@/lib/ownership/types";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";

/** Preserve accepted identities and review decisions inside the source-write transaction. */
export async function canSaveMusicDestination(
  writer: ScopedWriteDb,
  artistId: string,
  url: string,
): Promise<boolean> {
  const destination = parseMusicDestination(url);
  if (!destination || destination.kind !== "artist") return true;
  const mappings = rowsOf(
    await writer.execute(sql`
    select artist_id, platform_id from artist_id_mappings
    where platform = ${destination.platform} and (artist_id = ${artistId}::uuid or platform_id = ${destination.id})
  `),
  ) as { artist_id: string; platform_id: string }[];
  const excluded = rowsOf(
    await writer.execute(sql`
    select reason from artist_mapping_exclusions where artist_id = ${artistId}::uuid and platform = ${destination.platform}
  `),
  );
  const sources = rowsOf(
    await writer.execute(sql`
    select url, status from artist_vault_sources where artist_id = ${artistId}::uuid
  `),
  ) as { url: string; status: string }[];
  if (
    excluded.length ||
    mappings.some(row => row.artist_id !== artistId || row.platform_id !== destination.id)
  )
    return false;
  // Also honor existing direct platform values, which are not all ID mappings.
  if (
    [
      "spotify",
      "deezer",
      "bandcamp",
      "subvert",
      "supercollector",
      "soundcloud",
      "audius",
      "mixcloud",
    ].includes(destination.platform)
  ) {
    const rows = rowsOf(
      await writer.execute(sql`
      select ${sql.identifier(destination.platform)} as value from artists
      where id = ${artistId}::uuid or ${sql.identifier(destination.platform)} = ${destination.id}
    `),
    ) as { value: string | null }[];
    if (rows.some(row => row.value)) return false;
  }
  return !sources.some(source => {
    const held = parseMusicDestination(source.url);
    return (
      held?.kind === "artist" &&
      held.platform === destination.platform &&
      (held.id === destination.id || source.status === "approved" || source.status === "pending")
    );
  });
}
