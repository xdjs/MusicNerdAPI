import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { LeaderboardEntry } from "@/lib/leaderboard/types";

/**
 * Every account with its all-time artists added and research submissions,
 * ranked by the total (hidden accounts last), as MusicNerdWeb's
 * `getLeaderboard` ranks it. Accounts with nothing are dropped before any
 * caller paginates or totals.
 *
 * @returns The ranked entries; throws "Error getting leaderboard" on a database error.
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const result = rowsOf(
      await db.execute(sql`
            WITH artist_counts AS (
                SELECT added_by AS user_id,
                       COUNT(*) AS artist_count
                FROM artists
                GROUP BY added_by
            ),
            ugc_counts AS (
                SELECT user_id,
                       COUNT(*) AS ugc_count
                FROM ugcresearch
                GROUP BY user_id
            )
            SELECT u.id AS "userId",
                   u.wallet,
                   u.username,
                   u.email,
                   u.is_hidden AS "isHidden",
                   COALESCE(ac.artist_count, 0) AS "artistsCount",
                   COALESCE(uc.ugc_count, 0) AS "ugcCount"
            FROM users u
            LEFT JOIN artist_counts ac ON ac.user_id = u.id
            LEFT JOIN ugc_counts uc ON uc.user_id = u.id
            ORDER BY
                CASE WHEN u.is_hidden = true THEN 1 ELSE 0 END,
                (COALESCE(uc.ugc_count, 0) + COALESCE(ac.artist_count, 0)) DESC,
                COALESCE(uc.ugc_count, 0) DESC,
                COALESCE(ac.artist_count, 0) DESC,
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
    console.error("error getting leaderboard", e);
    throw new Error("Error getting leaderboard");
  }
}
