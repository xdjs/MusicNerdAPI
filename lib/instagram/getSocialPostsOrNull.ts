import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistSocialPosts } from "@/lib/db/schema";
import type { SocialPostRow } from "@/lib/instagram/types";

/**
 * The artist's stored posts, or null when the read failed. A failed read is
 * not an artist with no posts: MusicNerdWeb's version returned [] for both,
 * so a pool error completed a caption job as "no posts".
 *
 * @param artistId - The artist.
 * @returns The posts, or null on a database error.
 */
export async function getSocialPostsOrNull(artistId: string): Promise<SocialPostRow[] | null> {
  try {
    const rows = await db.query.artistSocialPosts.findMany({
      where: eq(artistSocialPosts.artistId, artistId),
    });
    return rows.map(r => ({
      platform: r.platform,
      platformPostId: r.platformPostId,
      ownerUsername: r.ownerUsername,
      isOwnPost: r.isOwnPost,
      caption: r.caption,
      url: r.url,
      postedAt: r.postedAt ?? "",
      likeCount: r.likeCount,
      commentCount: r.commentCount,
      playCount: r.playCount,
      hashtags: r.hashtags ?? [],
      mentions: r.mentions ?? [],
      coauthors: r.coauthors ?? [],
      musicTitle: r.musicTitle,
      musicArtist: r.musicArtist,
    }));
  } catch (e) {
    console.error("[getSocialPostsOrNull] Error:", e);
    return null;
  }
}
