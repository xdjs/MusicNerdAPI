import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistSocialCredits } from "@/lib/db/schema";

/**
 * Posts this artist already has a credit or statement for, so the sweep asks
 * only about the captions that produced nothing.
 *
 * @param artistId - The artist.
 * @returns Their post urls; empty on any failure.
 */
export async function claimedSourceUrls(artistId: string): Promise<Set<string>> {
  if (!artistId) return new Set();
  try {
    const rows = await db
      .select({ url: artistSocialCredits.sourceUrl })
      .from(artistSocialCredits)
      .where(eq(artistSocialCredits.artistId, artistId));
    return new Set(rows.map(r => r.url));
  } catch (e) {
    console.error("[claimedSourceUrls] Error:", e);
    return new Set();
  }
}
