import { and, eq } from "drizzle-orm";
import type { db } from "@/lib/db/db";
import { artistClaims } from "@/lib/db/schema";

/**
 * The artist's approved claim. A replacement claim is a new row, so its id
 * is the claim generation the claim-checked writes compare against.
 *
 * @param reader - The database, or an open transaction.
 * @param artistId - The artist.
 * @returns The approved claim, or undefined when there is none.
 */
export async function findApprovedClaim(reader: Pick<typeof db, "query">, artistId: string) {
  return reader.query.artistClaims.findFirst({
    where: and(eq(artistClaims.artistId, artistId), eq(artistClaims.status, "approved")),
  });
}
