import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistClaims } from "@/lib/db/schema";

/**
 * The artist's approved claim, captured before sources are read. A replacement
 * claim is a new generation, and a rebuild started under the old one must not
 * write.
 *
 * @param artistId - The artist.
 * @returns The approved claim's id, or null when there is none.
 */
export async function getLoreClaimGeneration(artistId: string): Promise<string | null> {
  const claim = await db.query.artistClaims.findFirst({
    where: and(eq(artistClaims.artistId, artistId), eq(artistClaims.status, "approved")),
  });
  return claim?.id ?? null;
}
