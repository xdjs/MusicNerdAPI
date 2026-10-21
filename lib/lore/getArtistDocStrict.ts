import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistDocs } from "@/lib/db/schema";

/**
 * The artist's Lore document, for callers that must not mistake a failed read
 * for an empty document.
 *
 * @param artistId - The artist.
 * @returns The row, or undefined when there is none; throws on a database error.
 */
export async function getArtistDocStrict(artistId: string) {
  return db.query.artistDocs.findFirst({ where: eq(artistDocs.artistId, artistId) });
}
