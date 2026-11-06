import { sql } from "drizzle-orm";
import { CONTRIBUTOR_PREVIEW_LIMIT } from "@/lib/contributorApprovals/const";
import type { PendingSubmission } from "@/lib/contributorApprovals/types";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";

/**
 * The contributor's own pending link suggestions and submitted or uploaded
 * Lore sources across every artist, oldest first.
 *
 * @param contributorId - The contributor's user id.
 * @returns Up to 200 items, and whether more are pending.
 */
export async function listPendingSubmissions(
  contributorId: string,
): Promise<{ items: PendingSubmission[]; hasMore: boolean }> {
  const rows = rowsOf(
    await db.execute(sql`
      with pending as (
        select g.id, 'link'::text as type, g.site_name as title, g.ugc_url as url, g.artist_id,
          g.created_at at time zone 'UTC' as created_at
        from ugcresearch g where g.user_id = ${contributorId}::uuid and g.origin = 'submission'
          and g.accepted is not true and g.date_processed is null
          and g.artist_id is not null and g.site_name is distinct from 'ugc_discord_ping'
        union all
        select s.id, case when s.file_path is not null or s.origin = 'upload' then 'upload' else 'lore' end,
          s.title, s.url, s.artist_id, s.created_at
        from artist_vault_sources s join artist_activity_events e on e.id = s.activity_id
        where e.actor_user_id = ${contributorId}::uuid and s.origin in ('submission', 'upload') and s.status = 'pending'
      ) select p.id, p.type, p.title, p.url, a.name as "artistName"
        from pending p join artists a on a.id = p.artist_id
        order by p.created_at asc nulls first, p.type, p.id limit ${CONTRIBUTOR_PREVIEW_LIMIT + 1}
    `),
  ) as PendingSubmission[];
  return {
    items: rows.slice(0, CONTRIBUTOR_PREVIEW_LIMIT),
    hasMore: rows.length > CONTRIBUTOR_PREVIEW_LIMIT,
  };
}
