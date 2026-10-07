import { db } from "@/lib/db/db";
import { readKnowledgeInTransaction } from "./readKnowledgeInTransaction";
import type { KnowledgeQuery } from "./types";
/** Reopen one authorized original without loading unrelated evidence or writing on a read. */
export async function readArtistKnowledge(
  artistId: string,
  userId: string,
  query: Extract<KnowledgeQuery, { operation: "read" }>,
) {
  return db.transaction(tx => readKnowledgeInTransaction(tx, artistId, userId, query), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}
