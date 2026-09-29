import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";

/**
 * The artist's name, for dropping self-credited audio when mapping posts.
 *
 * @param artistId - The artist.
 * @returns The name, or undefined when missing or the lookup failed.
 */
export async function getArtistNameById(artistId: string): Promise<string | undefined> {
  try {
    const row = await db.query.artists.findFirst({
      where: eq(artists.id, artistId),
      columns: { name: true },
    });
    return row?.name ?? undefined;
  } catch (e) {
    console.error("[getArtistNameById] Error:", e);
    return undefined;
  }
}
