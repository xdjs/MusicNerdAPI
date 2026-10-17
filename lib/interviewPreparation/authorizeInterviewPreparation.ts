import { sql } from "drizzle-orm";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import type { TransactionDb } from "@/lib/ownership/types";
/** Paid preparation is an approved claimant opt-in; admin status alone is insufficient. */
export async function authorizeInterviewPreparation(
  tx: TransactionDb,
  artistId: string,
  userId: string,
) {
  await authorizeArtistKnowledge(tx, artistId, userId);
  const [claim] = await tx.execute<{ id: string }>(
    sql`select id from artist_claims where artist_id=${artistId}::uuid and user_id=${userId}::uuid and status='approved' limit 1`,
  );
  if (!claim)
    throw new KnowledgeError("forbidden", 403, "The approved artist claimant is required.");
  return claim.id;
}
