import { and, eq, inArray } from "drizzle-orm";
import { generateReferenceCode } from "@/lib/claims/generateReferenceCode";
import { db } from "@/lib/db/db";
import { artistClaims, artists } from "@/lib/db/schema";

/**
 * Files a pending claim on an artist for a user. Only a pending or approved
 * claim blocks another; rejected claims stay for the record.
 *
 * @param userId - The claimant.
 * @param artistId - The artist.
 * @returns The new claim's reference code; `claimed` when the artist already has an active claim; `no_artist` when there is no such artist. Throws on a database error.
 */
export async function createArtistClaim(
  userId: string,
  artistId: string,
): Promise<{ referenceCode: string } | "claimed" | "no_artist"> {
  const artist = await db.query.artists.findFirst({
    where: eq(artists.id, artistId),
    columns: { id: true },
  });
  if (!artist) return "no_artist";
  const active = await db.query.artistClaims.findFirst({
    where: and(
      eq(artistClaims.artistId, artistId),
      inArray(artistClaims.status, ["pending", "approved"]),
    ),
    columns: { id: true },
  });
  if (active) return "claimed";
  const referenceCode = generateReferenceCode();
  const inserted = await db
    .insert(artistClaims)
    .values({ userId, artistId, status: "pending", referenceCode })
    .onConflictDoNothing()
    .returning({ id: artistClaims.id });
  return inserted.length ? { referenceCode } : "claimed";
}
