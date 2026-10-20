import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import type { LeaderboardEntry } from "@/lib/leaderboard/leaderboardTypes";

/**
 * Leaderboard scoped to a date range.
 *
 * @param fromIso - ISO date string for the range start.
 * @param toIso - ISO date string for the range end.
 * @returns Leaderboard entries with at least one contribution in the range.
 */
export async function getLeaderboardInRange(
  fromIso: string,
  toIso: string,
): Promise<LeaderboardEntry[]> {
  const result = await db.execute<LeaderboardEntry>(sql`
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
  `);
  return result.filter(entry => entry.ugcCount > 0 || entry.artistsCount > 0);
}
