import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { queueLoreRefreshInTransaction } from "@/lib/research/queueLoreRefreshInTransaction";
import { readInterviewSessionState } from "./readInterviewSessionState";
/** Close a sitting and queue its derived Lore update atomically; retries never repeat paid starts. */
export async function finishInterviewSession(artistId: string, userId: string, sessionId: string) {
  if (!z.uuid().safeParse(sessionId).success)
    throw new KnowledgeError("invalid_input", 400, "Invalid session");
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeArtistKnowledge(tx, artistId, userId);
    const state = await readInterviewSessionState(tx, artistId, sessionId);
    if (state.session?.state === "finished") return state;
    await tx.execute(
      sql`update artist_interview_answers a set source='skipped',created_at=clock_timestamp() where a.artist_id=${artistId}::uuid and a.source='offered' and exists(select 1 from artist_interview_question_evidence e where e.answer_id=a.id and e.session_id=${sessionId}::uuid)`,
    );
    await tx.execute(
      sql`update artist_interview_sessions set state='finished',closed_at=clock_timestamp() where id=${sessionId}::uuid and artist_id=${artistId}::uuid`,
    );
    if (state.session?.questions.some(q => q.state === "answered")) {
      const [claim] = await tx.execute<{ id: string }>(
        sql`select id from artist_claims where artist_id=${artistId}::uuid and status='approved' limit 1`,
      );
      await queueLoreRefreshInTransaction(tx, artistId, claim?.id ?? null);
    }
    return readInterviewSessionState(tx, artistId, sessionId);
  });
}
