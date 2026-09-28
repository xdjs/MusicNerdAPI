import type { WriteDb } from "@/lib/db/db";
import { upsertSocialPost } from "@/lib/instagram/upsertSocialPost";
import type { IngestResult, SocialPostInsert } from "@/lib/instagram/types";

/**
 * Upserts a batch of posts in one transaction and counts them.
 *
 * @param rows - Mapped posts, with thumbnails attached.
 * @param writer - The transaction to write in.
 * @returns How many were stored, split into own posts and collaborations.
 */
export async function upsertMappedRows(
  rows: SocialPostInsert[],
  writer: WriteDb,
): Promise<IngestResult> {
  let ownPosts = 0;
  for (const row of rows) {
    await upsertSocialPost(row, writer);
    if (row.isOwnPost) ownPosts += 1;
  }
  return { ingested: rows.length, ownPosts, collabPosts: rows.length - ownPosts };
}
