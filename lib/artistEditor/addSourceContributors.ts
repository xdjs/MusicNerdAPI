import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { VaultSource } from "@/lib/vault/types";

/**
 * Adds `contributorName` to each source: the username of the user whose
 * activity submitted or uploaded it. MusicNerdWeb's `addSourceContributors`,
 * query for query. Hidden users and usernames that are an email or a wallet
 * are never named. Call only after the claimant-or-admin check.
 *
 * @param artistId - The artist the sources belong to.
 * @param sources - The artist's sources.
 * @returns The same sources, in order, each with `contributorName` (null when unnamed).
 */
export async function addSourceContributors(
  artistId: string,
  sources: VaultSource[],
): Promise<(VaultSource & { contributorName: string | null })[]> {
  const contributed = (s: VaultSource) =>
    s.artistId === artistId && (s.origin === "submission" || s.origin === "upload");
  const ids = [
    ...new Set(
      sources
        .filter(contributed)
        .map(s => s.activityId)
        .filter((id): id is string => !!id),
    ),
  ];
  const names = new Map<string, string>();
  if (ids.length) {
    const rows = await db.execute(sql`
      select e.id, u.username from artist_activity_events e
      join users u on u.id = e.actor_user_id
      where e.artist_id = ${artistId}::uuid and e.actor_kind = 'user'
        and u.is_hidden = false
        and position('@' in u.username) = 0
        and lower(btrim(u.username)) is distinct from lower(btrim(u.wallet))
        and e.id in (${sql.join(
          ids.map(id => sql`${id}::uuid`),
          sql`, `,
        )})`);
    for (const row of rowsOf(rows) as { id: string; username: unknown }[]) {
      const name = typeof row.username === "string" ? row.username.trim() : "";
      if (name) names.set(String(row.id), name);
    }
  }
  return sources.map(source => ({
    ...source,
    contributorName: contributed(source) ? (names.get(source.activityId ?? "") ?? null) : null,
  }));
}
