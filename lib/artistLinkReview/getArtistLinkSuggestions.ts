import { sql } from "drizzle-orm";
import { lockLinkReview } from "@/lib/artistLinkReview/lockLinkReview";
import type { LinkSuggestion } from "@/lib/artistLinkReview/types";
import { db } from "@/lib/db/db";
import { isDestinationSource } from "@/lib/musicLinks/isDestinationSource";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";
import { getUserDisplayName } from "@/lib/users/getUserDisplayName";

const PAGE_SIZE = 100;

const toIso = (value: unknown) =>
  value ? new Date(value instanceof Date ? value.getTime() : String(value)).toISOString() : null;

/**
 * One page of the artist's link suggestions for its owner: UGC submissions and
 * Lore sources that resolve to an artist destination, pending first then
 * newest. Song and album URLs are left out; people are display names only.
 *
 * @param artistId - The artist.
 * @param userId - The claimant or admin asking.
 * @param offset - The page offset, 0-100000.
 * @returns `{ items, hasMore, nextOffset }`; throws OwnershipChangedError for anyone else.
 */
export async function getArtistLinkSuggestions(artistId: string, userId: string, offset = 0) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
    throw new Error("Invalid page offset");
  return db.transaction(async tx => {
    await lockLinkReview(tx, artistId, userId);
    const rows = await tx.execute<Record<string, unknown>>(sql`with suggestions as (
      select g.id,'ugc' as kind,g.ugc_url as url,g.site_name as title,g.site_name as platform,
        case when g.accepted then 'approved' when g.date_processed is not null then 'rejected' else 'pending' end as status,
        g.origin,g.created_at at time zone 'UTC' as submitted_at,g.user_id,null::text as type,g.date_processed at time zone 'UTC' as processed_at
      from ugcresearch g where g.artist_id=${artistId}::uuid and g.site_name is distinct from 'ugc_discord_ping'
        and not (g.accepted is true and exists(select 1 from artist_vault_sources linked where linked.artist_id=g.artist_id and linked.url=g.ugc_url))
      union all
      select s.id,'source',s.url,s.title,null,s.status::text,s.origin,s.created_at,e.actor_user_id,s.type,null::timestamptz
      from artist_vault_sources s left join artist_activity_events e on e.id=s.activity_id
      where s.artist_id=${artistId}::uuid and s.file_path is null and s.podcast_episode_key is null
    ) select s.*,u.username,u.wallet,u.is_hidden,r.action as review_action,coalesce(r.created_at,s.processed_at) as reviewed_at,r.actor_user_id as reviewer_id,ru.is_hidden as reviewer_hidden,ru.username as reviewer_name,ru.wallet as reviewer_wallet
    from suggestions s left join users u on u.id=s.user_id
    left join lateral (select created_at,actor_user_id,action from artist_activity_events where artist_id=${artistId}::uuid and source_id=s.id
      and action in ('link_approved','link_rejected','source_approved','source_rejected','link_hidden','link_shown') order by created_at desc,id desc limit 1) r on true
    left join users ru on ru.id=r.actor_user_id
    order by (s.status='pending') desc,s.submitted_at desc,s.id limit ${PAGE_SIZE + 1} offset ${offset}`);
    const items: LinkSuggestion[] = [];
    for (const row of rows.slice(0, PAGE_SIZE)) {
      const url = String(row.url ?? "");
      const destination = parseMusicDestination(url);
      if (
        !url ||
        destination?.kind === "release" ||
        (row.kind === "source" && !isDestinationSource({ url, type: row.type as string | null }))
      )
        continue;
      const suggester = row.user_id && !row.is_hidden;
      const reviewer = row.reviewer_id && !row.reviewer_hidden;
      items.push({
        id: String(row.id),
        kind: row.kind as LinkSuggestion["kind"],
        url,
        title: String(row.title ?? destination?.label ?? "Website"),
        platform: String(row.platform ?? destination?.platform ?? "website"),
        hidden: row.review_action === "link_hidden",
        status: row.status as LinkSuggestion["status"],
        origin: String(row.origin),
        submittedAt: toIso(row.submitted_at),
        suggestedBy: {
          id: suggester ? String(row.user_id) : null,
          name:
            row.origin === "research"
              ? "Automated research"
              : suggester
                ? getUserDisplayName({
                    username: row.username as string | null,
                    wallet: row.wallet as string | null,
                  })
                : "Not recorded",
        },
        reviewedAt: toIso(row.reviewed_at),
        reviewedBy: row.reviewed_at
          ? {
              id: reviewer ? String(row.reviewer_id) : null,
              name: reviewer
                ? getUserDisplayName({
                    username: row.reviewer_name as string | null,
                    wallet: row.reviewer_wallet as string | null,
                  })
                : "Not recorded",
            }
          : null,
      });
    }
    const hasMore = rows.length > PAGE_SIZE;
    return { items, hasMore, nextOffset: hasMore ? offset + PAGE_SIZE : null };
  });
}
