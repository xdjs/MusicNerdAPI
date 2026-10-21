import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";

/**
 * The sources whose profile link the artist hid. Visibility is separate from
 * approval: the latest of `link_hidden`, `link_shown` and `source_approved`
 * decides, and a hidden link keeps its Lore evidence.
 *
 * @param artistId - The artist.
 * @returns The hidden sources' ids.
 */
export async function getHiddenLinkSourceIds(artistId: string): Promise<string[]> {
  const rows = rowsOf(
    await db.execute(sql`select source_id from (
    select distinct on (source_id) source_id,action from artist_activity_events
    where artist_id=${artistId}::uuid and action in ('link_hidden','link_shown','source_approved')
    order by source_id,created_at desc,id desc
  ) latest where action='link_hidden'`),
  ) as { source_id: unknown }[];
  return rows.map(row => String(row.source_id));
}
