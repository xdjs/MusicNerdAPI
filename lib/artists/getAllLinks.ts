import { UNRESOLVED_URLMAP_SITES, URLMAP_TTL_MS } from "@/lib/artists/const";
import type { UrlMapRow } from "@/lib/artists/types";
import { db } from "@/lib/db/db";

let urlmapCache: { rows: UrlMapRow[]; at: number } | null = null;

/**
 * Every urlmap row discovery resolves against. A run resolves dozens of URLs,
 * so the table is memoized for a minute per warm instance: a plain module memo,
 * since this runs where Next's cache has no request context.
 *
 * @returns The urlmap rows, without catalog, foundation and sound.xyz.
 */
export async function getAllLinks(): Promise<UrlMapRow[]> {
  if (urlmapCache && Date.now() - urlmapCache.at < URLMAP_TTL_MS) return urlmapCache.rows;
  const rows = (await db.query.urlmap.findMany()).filter(
    row => !UNRESOLVED_URLMAP_SITES.includes(row.siteName),
  );
  urlmapCache = { rows, at: Date.now() };
  return rows;
}
