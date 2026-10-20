import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { readEditorSourceSearch } from "./readEditorSourceSearch";

/** Reauthorizes status reads without queuing work or contacting a provider. */
export async function getEditorSourceSearch(artistId: string, userId: string, requestId: string) {
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeArtistKnowledge(tx, artistId, userId);
    const result = await readEditorSourceSearch(tx, artistId, userId, requestId);
    if (!result) throw new KnowledgeError("not_found", 404, "Search request not found");
    return result;
  });
}
