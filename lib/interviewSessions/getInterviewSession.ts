import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { readInterviewSessionState } from "./readInterviewSessionState";
/** Restore a durable interview; no offers, paid work or writes on reads. */
export async function getInterviewSession(artistId: string, userId: string) {
  return db.transaction(
    async tx => {
      await authorizeArtistKnowledge(tx, artistId, userId);
      const saved = await readInterviewSessionState(tx, artistId);
      if (saved.session?.state === "active") return saved;
      const [pending] = await tx.execute<{ id: string; status: string }>(
        sql`select j.id,j.status from artist_research_jobs j join artist_claims c on c.artist_id=j.artist_id and c.id::text=j.state->>'claimId' where j.artist_id=${artistId}::uuid and j.kind='interview_prepare' and j.state->>'mode'='claim_preparation' and j.state->>'userId'=${userId} and c.user_id=${userId}::uuid and c.status='approved' and j.status in ('pending','running','queued') order by j.created_at desc limit 1`,
      );
      return pending
        ? {
            ...saved,
            preparation: {
              jobId: pending.id,
              status: pending.status === "running" ? ("running" as const) : ("pending" as const),
              phase: "preparing" as const,
              readyCount: 0,
              totalCount: 3,
            },
          }
        : saved;
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
