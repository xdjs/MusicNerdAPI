import { retainInstagramThumbnail } from "@/lib/instagram/retainInstagramThumbnail";
import type { ThumbnailUploadScope } from "@/lib/instagram/types";

type ThumbnailRow = { artistId: string; platformPostId: string; isOwnPost: boolean; raw: unknown };

/**
 * Retains thumbnails three at a time, outside any database transaction.
 * Only the artist's own posts: Latest publishes nothing else.
 *
 * @param rows - Mapped posts.
 * @param scope - The job doing the work.
 * @returns The rows, own posts carrying their retained thumbnail.
 */
export async function retainInstagramThumbnails<T extends ThumbnailRow>(
  rows: T[],
  scope?: ThumbnailUploadScope,
): Promise<T[]> {
  const prepared = [...rows];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, rows.length) }, async () => {
      while (cursor < rows.length) {
        const index = cursor++;
        const row = rows[index]!;
        if (row.isOwnPost) {
          prepared[index] = {
            ...row,
            raw: await retainInstagramThumbnail(row.raw, row.artistId, row.platformPostId, scope),
          };
        }
      }
    }),
  );
  return prepared;
}
