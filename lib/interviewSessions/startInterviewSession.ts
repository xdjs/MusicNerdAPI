import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { validateInterviewSessionBody } from "./validateInterviewSessionBody";
import { readInterviewSessionState } from "./readInterviewSessionState";
/** Explicit, idempotent start with one active sitting and no model work under the lock. */
export async function startInterviewSession(artistId: string, userId: string, body: unknown) {
  const input = validateInterviewSessionBody("start", body);
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeArtistKnowledge(tx, artistId, userId);
    const [existing] = await tx.execute<{ id: string }>(
      sql`select id from artist_interview_sessions where artist_id=${artistId}::uuid and request_id=${input.requestId}::uuid`,
    );
    if (existing) return readInterviewSessionState(tx, artistId, existing.id);
    const state = await readInterviewSessionState(tx, artistId);
    if (state.legacyOffers.length)
      throw new KnowledgeError(
        "legacy_interview_open",
        409,
        "Finish the earlier offered questions before starting a new sitting",
      );
    if (state.session?.state === "active")
      throw new KnowledgeError(
        "session_active",
        409,
        "An interview is already active; reload to resume it",
      );
    const [latest] = await tx.execute<{ sitting: number }>(
      sql`select greatest(coalesce((select max(coalesce(sitting,1)) from artist_interview_answers where artist_id=${artistId}::uuid),0),coalesce((select max(sitting) from artist_interview_sessions where artist_id=${artistId}::uuid),0))+1 as sitting`,
    );
    if (!latest || latest.sitting > 2147483647)
      throw new KnowledgeError("interview_limit", 413, "No further sitting is available");
    const [saved] = await tx.execute<{ id: string }>(
      sql`insert into artist_interview_sessions(artist_id,request_id,sitting,created_by)values(${artistId}::uuid,${input.requestId}::uuid,${latest.sitting},${userId}::uuid)returning id`,
    );
    if (!saved) throw new Error("Interview was not persisted");
    return readInterviewSessionState(tx, artistId, saved.id);
  });
}
