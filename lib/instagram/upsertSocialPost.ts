import { sql } from "drizzle-orm";
import type { WriteDb } from "@/lib/db/db";
import { artistSocialPosts } from "@/lib/db/schema";
import type { SocialPostInsert } from "@/lib/instagram/types";

/**
 * Inserts a post, or refreshes its metadata. A thumbnail already retained on
 * the stored row survives a refresh that failed to retain a new one.
 *
 * @param row - The mapped post.
 * @param writer - The transaction to write in.
 * @returns Nothing.
 */
export async function upsertSocialPost(row: SocialPostInsert, writer: WriteDb): Promise<void> {
  const raw = JSON.stringify(row.raw);
  await writer
    .insert(artistSocialPosts)
    .values(row)
    .onConflictDoUpdate({
      target: [
        artistSocialPosts.artistId,
        artistSocialPosts.platform,
        artistSocialPosts.platformPostId,
      ],
      set: {
        ownerUsername: row.ownerUsername,
        isOwnPost: row.isOwnPost,
        caption: row.caption,
        url: row.url,
        postedAt: row.postedAt,
        likeCount: row.likeCount,
        commentCount: row.commentCount,
        playCount: row.playCount,
        hashtags: row.hashtags,
        mentions: row.mentions,
        coauthors: row.coauthors,
        musicTitle: row.musicTitle,
        musicArtist: row.musicArtist,
        raw: sql`(CASE
          WHEN ${raw}::jsonb->'_musicnerdThumbnail'->>'version' = '1' THEN ${raw}::jsonb
          WHEN ${artistSocialPosts.raw}->'_musicnerdThumbnail'->>'version' = '1'
            THEN ${raw}::jsonb || jsonb_build_object(
              'displayUrl', ${artistSocialPosts.raw}->'_musicnerdThumbnail'->>'url',
              '_musicnerdThumbnail', ${artistSocialPosts.raw}->'_musicnerdThumbnail')
          ELSE ${raw}::jsonb END) || CASE
          WHEN ${artistSocialPosts.raw}->'_musicnerdTranscript'->>'version' = '1'
            THEN jsonb_build_object('_musicnerdTranscript', ${artistSocialPosts.raw}->'_musicnerdTranscript')
          ELSE '{}'::jsonb END`,
      },
    });
}
