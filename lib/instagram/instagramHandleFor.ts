import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";

/**
 * The artist's stored Instagram handle.
 *
 * @param artistId - The artist.
 * @returns The handle; null when there is none; "error" when the lookup failed, which must not be read as "no Instagram".
 */
export async function instagramHandleFor(artistId: string): Promise<string | null | "error"> {
  try {
    const artist = await db.query.artists.findFirst({
      where: eq(artists.id, artistId),
      columns: { instagram: true },
    });
    return artist?.instagram?.trim() || null;
  } catch (e) {
    console.error("[instagramHandleFor] Error:", e);
    return "error";
  }
}
