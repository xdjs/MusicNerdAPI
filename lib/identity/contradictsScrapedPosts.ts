import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";

/**
 * Does this Instagram candidate contradict the artist's own scraped posts? An
 * account can call itself anything (pherosistar titled itself "Pharaoh
 * Sistare"); the posts we scraped were authored by the real handle.
 *
 * @param artistId - The artist.
 * @param siteName - The platform; only Instagram is scraped.
 * @param handle - The candidate handle.
 * @returns True when their own posts name a different author; false with no posts or on error (fails open).
 */
export async function contradictsScrapedPosts(
  artistId: string,
  siteName: string,
  handle: string,
): Promise<boolean> {
  if (siteName !== "instagram") return false;
  try {
    const rows = await db.execute(sql`
      select distinct owner_username from artist_social_posts
      where artist_id = ${artistId}::uuid and is_own_post = true
      limit 5`);
    const known = rowsOf(rows)
      .map(r => String((r as { owner_username?: unknown }).owner_username ?? ""))
      .filter(Boolean)
      .map(normalizeHandle);
    if (known.length === 0) return false;
    return !known.includes(normalizeHandle(handle));
  } catch (e) {
    // Fails open: this only adds evidence we happen to hold.
    console.error("[vaultWebSearch] Scraped-post check failed:", e);
    return false;
  }
}
