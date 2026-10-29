import { sql } from "drizzle-orm";
import type {
  AdminContributionsQuery,
  Contribution,
  ContributionOrigin,
} from "@/lib/adminContributions/types";
import { clampPage } from "@/lib/db/clampPage";
import { db } from "@/lib/db/db";
import { likePattern } from "@/lib/db/likePattern";
import { rowsOf } from "@/lib/db/rowsOf";

const PAGE_SIZE = 25;

/**
 * Contributions for the admin contributions page: link suggestions, Lore
 * sources and uploads across every artist, newest first, 25 per page, with
 * counts per origin. MusicNerdWeb's `getAdminContributions`, query for query;
 * the caller checks the admin role first.
 *
 * @param filters - The validated filters (see `validateAdminContributionsQuery`).
 * @returns One page, per-origin counts, the total and the filters.
 */
export async function getAdminContributions(filters: AdminContributionsQuery) {
  const { userId, query, origin, type, status, page } = filters;
  const pattern = likePattern(query);
  const base = sql`with contributions as (
    select g.id, 'link'::text as type,
      case when g.origin = 'submission' then 'user' when g.origin = 'research' then 'research' else 'unknown' end as origin,
      g.artist_id, g.user_id, g.site_name as title, g.ugc_url as url,
      case when g.accepted then 'approved' when g.date_processed is not null then 'rejected' else 'pending' end as status,
      g.created_at at time zone 'UTC' as created_at, null::text as trigger, null::uuid as activity_id,
      case when g.user_id is not null then 'user' else 'unknown' end as actor_kind
    from ugcresearch g where g.site_name is distinct from 'ugc_discord_ping' and g.artist_id is not null
    union all
    select s.id, case when s.file_path is not null or s.origin = 'upload' then 'upload' else 'lore' end,
      case when s.origin in ('submission', 'upload') then 'user' when s.origin = 'research' then 'research' else 'unknown' end,
      s.artist_id, e.actor_user_id, s.title, s.url, s.status::text, s.created_at, e.trigger, s.activity_id, e.actor_kind
    from artist_vault_sources s left join artist_activity_events e on e.id = s.activity_id
  ), scoped as (
    select c.*, a.name as artist_name, u.username, u.email
    from contributions c join artists a on a.id = c.artist_id left join users u on u.id = c.user_id
    where ${userId ? sql`c.user_id = ${userId}::uuid` : sql`true`}
      and ${type ? sql`c.type = ${type}` : sql`true`}
      and ${query ? sql`(a.name ilike ${pattern} or c.title ilike ${pattern} or c.url ilike ${pattern} or u.username ilike ${pattern} or u.email ilike ${pattern})` : sql`true`}
  )`;
  const selected = sql`${origin ? sql`origin = ${origin}` : sql`true`} and ${status === "all" ? sql`true` : sql`status = ${status}`}`;
  const [groups, matches] = await Promise.all([
    db.execute(
      sql`${base} select origin, count(*)::int as total, count(*) filter (where status = 'pending')::int as pending from scoped group by origin`,
    ),
    db.execute(sql`${base} select count(*)::int as total from scoped where ${selected}`),
  ]);
  const counts: Record<ContributionOrigin, { total: number; pending: number }> = {
    user: { total: 0, pending: 0 },
    research: { total: 0, pending: 0 },
    unknown: { total: 0, pending: 0 },
  };
  for (const row of rowsOf(groups) as { origin: string; total: number; pending: number }[])
    if (row.origin in counts)
      counts[row.origin as ContributionOrigin] = {
        total: Number(row.total),
        pending: Number(row.pending),
      };
  const total = Number((rowsOf(matches)[0] as { total?: number } | undefined)?.total ?? 0);
  const current = clampPage(page, total, PAGE_SIZE);
  const rows =
    await db.execute(sql`${base} select id, type, origin, artist_id as "artistId", artist_name as "artistName", title, url,
    user_id as "userId", username, email, actor_kind as "actorKind", status, created_at::text as "createdAt", trigger, activity_id as "activityId"
    from scoped where ${selected} order by created_at desc nulls last, type, id desc limit ${PAGE_SIZE} offset ${(current - 1) * PAGE_SIZE}`);
  return {
    items: rowsOf(rows) as Contribution[],
    counts,
    total,
    page: current,
    pageSize: PAGE_SIZE,
    filters: { userId, query, origin, type, status },
  };
}
