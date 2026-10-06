import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { toInterviewBoundary } from "@/lib/interviewMemory/toInterviewBoundary";
import type { BoundaryRow } from "@/lib/interviewMemory/types";
/** Retract an exact instruction without rewriting its original wording or origin. */
export async function retractInterviewBoundary(
  artistId: string,
  userId: string,
  boundaryId: string,
  revision: string,
) {
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeArtistKnowledge(tx, artistId, userId);
    const [row] = await tx.execute<BoundaryRow>(
      sql`select * from artist_interview_boundaries where id=${boundaryId}::uuid and artist_id=${artistId}::uuid for update`,
    );
    if (!row) throw new KnowledgeError("not_found", 404, "Boundary unavailable");
    const boundary = toInterviewBoundary(row);
    if (boundary.revision !== revision)
      throw new KnowledgeError(
        "boundary_changed",
        409,
        "Boundary changed; reload before retracting",
      );
    if (row.retracted_at) return { status: "ok" as const, boundary };
    const activityId = await recordArtistActivity(
      artistId,
      "interview_boundary_retracted",
      { userId, trigger: "explicit_interview_boundary" },
      tx,
    );
    const [changed] = await tx.execute<BoundaryRow>(
      sql`update artist_interview_boundaries set retracted_at=now(),retracted_by=${userId}::uuid,retraction_activity_id=${activityId}::uuid where id=${boundaryId}::uuid returning *`,
    );
    if (!changed) throw new Error("Boundary retraction was not saved");
    return { status: "ok" as const, boundary: toInterviewBoundary(changed) };
  });
}
