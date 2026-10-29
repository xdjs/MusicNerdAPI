import { and, eq, inArray, sql } from "drizzle-orm";
import { generateReferenceCode } from "@/lib/claims/generateReferenceCode";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
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
  // reference_code isn't in the shared Drizzle schema, which declares only the columns other routes read.
  const inserted = rowsOf(
    await db.execute(sql`insert into artist_claims (user_id, artist_id, status, reference_code)
      values (${userId}::uuid, ${artistId}::uuid, 'pending', ${referenceCode})
      on conflict do nothing returning id`),
  );
  return inserted.length ? { referenceCode } : "claimed";
}
