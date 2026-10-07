import { db } from "@/lib/db/db";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { readInterviewSessionState } from "./readInterviewSessionState";
/** Restore a durable interview; no offers, paid work or writes on reads. */
export async function getInterviewSession(artistId: string, userId: string) {
  return db.transaction(
    async tx => {
      await authorizeArtistKnowledge(tx, artistId, userId);
      return readInterviewSessionState(tx, artistId);
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
