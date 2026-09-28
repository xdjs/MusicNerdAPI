import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistSocialPosts } from "@/lib/db/schema";
import { retainInstagramThumbnails } from "@/lib/instagram/retainInstagramThumbnails";
import { storedInstagramThumbnail } from "@/lib/instagram/storedInstagramThumbnail";
import type { SocialPostInsert, ThumbnailUploadScope } from "@/lib/instagram/types";

/**
 * Attaches thumbnails to a batch of posts: reuses ones already stored for
 * this post instead of duplicating the feed for every refresh job, and
 * retains the rest.
 *
 * @param rows - Mapped posts, all for one artist.
 * @param scope - The job doing the work.
 * @returns The rows, own posts carrying their thumbnail.
 */
export async function retainMappedThumbnails(
  rows: SocialPostInsert[],
  scope?: ThumbnailUploadScope,
): Promise<SocialPostInsert[]> {
  if (!rows.length) return rows;
  const stored = await db.query.artistSocialPosts.findMany({
    where: and(
      eq(artistSocialPosts.artistId, rows[0]!.artistId),
      eq(artistSocialPosts.platform, "instagram"),
      inArray(
        artistSocialPosts.platformPostId,
        rows.map(row => row.platformPostId),
      ),
    ),
    columns: { platformPostId: true, raw: true },
  });
  const retained = new Map((stored ?? []).map(row => [row.platformPostId, row.raw]));
  const reuse = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const thumbnail = row.isOwnPost
      ? storedInstagramThumbnail(retained.get(row.platformPostId), row.artistId, row.platformPostId)
      : null;
    if (thumbnail) reuse.set(row.platformPostId, thumbnail);
  }
  const fresh = await retainInstagramThumbnails(
    rows.filter(row => !reuse.has(row.platformPostId)),
    scope,
  );
  const prepared = new Map(fresh.map(row => [row.platformPostId, row]));
  return rows.map(row => {
    const thumbnail = reuse.get(row.platformPostId);
    if (!thumbnail) return prepared.get(row.platformPostId)!;
    const raw = row.raw as Record<string, unknown>;
    return { ...row, raw: { ...raw, displayUrl: thumbnail.url, _musicnerdThumbnail: thumbnail } };
  });
}
