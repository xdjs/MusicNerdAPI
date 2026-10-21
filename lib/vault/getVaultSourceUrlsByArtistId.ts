import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistVaultSources } from "@/lib/db/schema";

/**
 * The URLs of every source in the artist's vault, whatever its status, for
 * comparing identities without loading the stored article bodies.
 *
 * @param artistId - The artist.
 * @returns The non-empty URLs.
 */
export async function getVaultSourceUrlsByArtistId(artistId: string): Promise<string[]> {
  const rows = await db.query.artistVaultSources.findMany({
    columns: { url: true },
    where: eq(artistVaultSources.artistId, artistId),
  });
  return rows.map(row => row.url).filter((url): url is string => !!url);
}
