import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";

/** One event on the public activity feed, as the database returns it. */
export type ActivityEvent = {
  type: "agent_mapping" | "ugc_approved" | "artist_added" | "self_edit_added" | "self_edit_updated";
  artist_id: string;
  artist_name: string | null;
  platform: string | null;
  created_at: string;
};

/**
 * The most recent public events, newest first: agent link mappings (resolved
 * `mapping:*` audit rows), approved submissions (by the moderation date, so
 * unmoderated ones never show), artists' own profile edits and new artists.
 * MusicNerdWeb's `getRecentActivity`, verbatim: one query, `since` optional
 * inside the SQL. Not the `artist_activity_events` ledger `lib/activity` writes.
 *
 * @param since - Only events after this moment; every event when omitted.
 * @param limit - How many events, and how many per source before the merge.
 * @returns The events, newest first.
 */
export async function getRecentActivity(since?: string, limit = 15): Promise<ActivityEvent[]> {
  const sinceParam = since ?? null;
  const rows = await db.execute(sql`
        (SELECT 'agent_mapping' AS type, al.artist_id, a.name AS artist_name,
                al.field AS platform, al.created_at
         FROM mcp_audit_log al
         INNER JOIN artists a ON a.id = al.artist_id
         WHERE al.action = 'resolve' AND al.field LIKE 'mapping:%'
           AND (${sinceParam}::timestamptz IS NULL OR al.created_at > ${sinceParam}::timestamptz)
         ORDER BY al.created_at DESC LIMIT ${limit})

        UNION ALL

        (SELECT 'ugc_approved' AS type, u.artist_id, u.name AS artist_name,
                u.site_name AS platform, u.date_processed AS created_at
         FROM ugcresearch u
         WHERE u.accepted = true AND u.date_processed IS NOT NULL
           AND (${sinceParam}::timestamptz IS NULL OR u.date_processed > ${sinceParam}::timestamptz)
         ORDER BY u.date_processed DESC LIMIT ${limit})

        UNION ALL

        (SELECT CASE WHEN e.old_value IS NULL THEN 'self_edit_added' ELSE 'self_edit_updated' END AS type,
                e.artist_id, a.name AS artist_name, e.site_name AS platform, e.created_at
         FROM artist_self_edits e
         INNER JOIN artists a ON a.id = e.artist_id
         WHERE (${sinceParam}::timestamptz IS NULL OR e.created_at > ${sinceParam}::timestamptz)
         ORDER BY e.created_at DESC LIMIT ${limit})

        UNION ALL

        (SELECT 'artist_added' AS type, ar.id AS artist_id, ar.name AS artist_name,
                NULL AS platform, ar.created_at
         FROM artists ar
         WHERE (${sinceParam}::timestamptz IS NULL OR ar.created_at > ${sinceParam}::timestamptz)
         ORDER BY ar.created_at DESC LIMIT ${limit})

        ORDER BY created_at DESC
        LIMIT ${limit}
    `);
  return rowsOf(rows) as ActivityEvent[];
}
