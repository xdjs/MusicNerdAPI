import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistDocs } from "@/lib/db/schema";

/**
 * The artist's Lore document.
 *
 * @param artistId - The artist.
 * @returns The row, or undefined when there is none or the read failed.
 */
export async function getArtistDoc(artistId: string) {
  try {
    return await db.query.artistDocs.findFirst({ where: eq(artistDocs.artistId, artistId) });
  } catch (e) {
    console.error("[getArtistDoc] Error:", e);
    return undefined;
  }
}
