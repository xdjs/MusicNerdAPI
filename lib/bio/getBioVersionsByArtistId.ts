import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistBioVersions } from "@/lib/db/schema";

/**
 * The artist's saved bios, newest first.
 *
 * @param artistId - The artist.
 * @returns The versions.
 */
export async function getBioVersionsByArtistId(artistId: string) {
  return db.query.artistBioVersions.findMany({
    where: eq(artistBioVersions.artistId, artistId),
    orderBy: (versions, { desc }) => [desc(versions.createdAt)],
  });
}
