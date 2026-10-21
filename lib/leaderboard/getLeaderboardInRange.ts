import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { LeaderboardEntry } from "@/lib/leaderboard/types";

/**
 * Every account with its artists added and research submissions within a
 * period, ranked by the total (hidden accounts last), as MusicNerdWeb's
 * `getLeaderboardInRange` ranks it. Accounts with nothing in the period are
 * dropped before any caller paginates or totals.
 *
 * @param fromIso - Start of the period (inclusive).
 * @param toIso - End of the period (inclusive).
 * @returns The ranked entries; throws "Error getting leaderboard in range" on a database error.
 */
export async function getLeaderboardInRange(
  fromIso: string,
  toIso: string,
): Promise<LeaderboardEntry[]> {
  try {
    const result = rowsOf(
      await db.execute(sql`
            SELECT
                u.id   AS "userId",
                u.wallet,
                u.username,
                u.email,
                u.is_hidden AS "isHidden",
                (
                    SELECT COUNT(*)::int FROM artists a
                    WHERE a.added_by = u.id
                      AND a.created_at BETWEEN ${fromIso} AND ${toIso}
                ) AS "artistsCount",
                (
                    SELECT COUNT(*)::int FROM ugcresearch ug
                    WHERE ug.user_id = u.id
                      AND ug.created_at BETWEEN ${fromIso} AND ${toIso}
                ) AS "ugcCount"
            FROM users u
            ORDER BY
                CASE WHEN u.is_hidden = true THEN 1 ELSE 0 END,
                ((
                    SELECT COUNT(*)::int FROM ugcresearch ug
                    WHERE ug.user_id = u.id
                      AND ug.created_at BETWEEN ${fromIso} AND ${toIso}
                ) + (
                    SELECT COUNT(*)::int FROM artists a
                    WHERE a.added_by = u.id
                      AND a.created_at BETWEEN ${fromIso} AND ${toIso}
                )) DESC,
                (
                    SELECT COUNT(*)::int FROM ugcresearch ug
                    WHERE ug.user_id = u.id
                      AND ug.created_at BETWEEN ${fromIso} AND ${toIso}
                ) DESC,
                (
                    SELECT COUNT(*)::int FROM artists a
                    WHERE a.added_by = u.id
                      AND a.created_at BETWEEN ${fromIso} AND ${toIso}
                ) DESC,
                CASE
                    WHEN u.username IS NOT NULL THEN
                        CASE WHEN u.username ~ '^[0-9]' THEN 0 ELSE 1 END
                    ELSE
                        CASE WHEN u.wallet ~ '^0x[0-9]' THEN 0 ELSE 1 END
                    END,
                CASE
                    WHEN u.username IS NOT NULL THEN u.username
                    ELSE u.wallet
                END ASC
        `),
    ) as LeaderboardEntry[];
    // Filter before callers calculate totals, pagination or ranks.
    return result.filter(entry => Number(entry.ugcCount) > 0 || Number(entry.artistsCount) > 0);
  } catch (e) {
    console.error("error getting leaderboard in range", e);
    throw new Error("Error getting leaderboard in range");
  }
}
