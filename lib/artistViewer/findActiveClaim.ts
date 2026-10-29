import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistClaims } from "@/lib/db/schema";

/**
 * The artist's active claim: the one pending or approved claim an artist can
 * have at a time. Rejected claims are history. MusicNerdWeb's
 * `getClaimByArtistId`, without its swallowed error.
 *
 * @param artistId - The artist.
 * @returns The claim, or undefined when there is none; throws on a database error.
 */
export async function findActiveClaim(artistId: string) {
  return db.query.artistClaims.findFirst({
    where: and(
      eq(artistClaims.artistId, artistId),
      inArray(artistClaims.status, ["pending", "approved"]),
    ),
  });
}
