import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistSocialPosts } from "@/lib/db/schema";

/**
 * Whether any posts are stored for the artist.
 *
 * @param artistId - The artist.
 * @returns True when at least one post exists; false on error, so an error never skips an ingest.
 */
export async function hasSocialPosts(artistId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: artistSocialPosts.id })
      .from(artistSocialPosts)
      .where(eq(artistSocialPosts.artistId, artistId))
      .limit(1);
    return rows.length > 0;
  } catch (e) {
    console.error("[hasSocialPosts] Error:", e);
    return false;
  }
}
