import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";
import type { ArtistForDoc } from "@/lib/lore/types";

/**
 * The artist's name and links, for the Lore. A database error is thrown, so
 * the rebuild fails and retries instead of writing a Lore about nobody.
 *
 * @param artistId - The artist.
 * @returns The artist, or undefined when there is no such artist.
 */
export async function getArtistForDoc(artistId: string): Promise<ArtistForDoc | undefined> {
  return db.query.artists.findFirst({
    where: eq(artists.id, artistId),
    columns: {
      id: true,
      name: true,
      instagram: true,
      spotify: true,
      x: true,
      soundcloud: true,
      youtube: true,
    },
  });
}
