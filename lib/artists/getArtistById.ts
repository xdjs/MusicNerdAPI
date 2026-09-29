import { eq } from "drizzle-orm";
import type { ArtistRow } from "@/lib/artists/types";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";

/**
 * The full artist row.
 *
 * @param id - The artist.
 * @returns The row, or undefined when there is none; throws on a database error.
 */
export async function getArtistById(id: string): Promise<ArtistRow | undefined> {
  try {
    return await db.query.artists.findFirst({ where: eq(artists.id, id) });
  } catch (e) {
    console.error("Error fetching artist by Id", e);
    throw new Error("Error fetching artist by Id");
  }
}
