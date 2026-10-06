import { and, eq } from "drizzle-orm";
import { artists, artistClaims, users } from "@/lib/db/schema";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { TransactionDb } from "@/lib/ownership/types";

/** Rechecks the current account and claim inside the evidence read transaction. */
export async function authorizeArtistKnowledge(
  tx: Pick<TransactionDb, "select">,
  artistId: string,
  userId: string,
) {
  const [user] = await tx
    .select({ id: users.id, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new KnowledgeError("unauthenticated", 401, "Not signed in");
  if (!user.isAdmin) {
    const [claim] = await tx
      .select({ id: artistClaims.id })
      .from(artistClaims)
      .where(
        and(
          eq(artistClaims.artistId, artistId),
          eq(artistClaims.userId, userId),
          eq(artistClaims.status, "approved"),
        ),
      )
      .limit(1);
    if (!claim)
      throw new KnowledgeError("forbidden", 403, "Artist claimant or administrator required");
  }
  const [artist] = await tx
    .select({ id: artists.id, name: artists.name, bio: artists.bio })
    .from(artists)
    .where(eq(artists.id, artistId))
    .limit(1);
  if (!artist) throw new KnowledgeError("not_found", 404, "Artist unavailable");
  return artist;
}
