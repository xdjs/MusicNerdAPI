import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { validateBoundaryBody } from "@/lib/interviewMemory/validateBoundaryBody";
import { toInterviewBoundary } from "@/lib/interviewMemory/toInterviewBoundary";
import type { BoundaryRow } from "@/lib/interviewMemory/types";
/** Save only an explicit instruction tied to this artist's real offer, with atomic attribution. */
export async function saveInterviewBoundary(artistId: string, userId: string, value: unknown) {
  const input = validateBoundaryBody(value);
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeArtistKnowledge(tx, artistId, userId);
    const [previous] = await tx.execute<BoundaryRow>(
      sql`select * from artist_interview_boundaries where artist_id=${artistId}::uuid and request_id=${input.requestId}::uuid`,
    );
    if (previous) {
      if (
        previous.wording !== input.wording ||
        previous.scope !== input.scope ||
        previous.origin_question_key !== input.questionKey
      )
        throw new KnowledgeError(
          "boundary_conflict",
          409,
          "This request already saved a different instruction",
        );
      return { status: "ok" as const, boundary: toInterviewBoundary(previous) };
    }
    const [origin] = await tx.execute<{ id: string; sitting: number; question: string }>(
      sql`select id,coalesce(sitting,1) as sitting,question from artist_interview_answers where artist_id=${artistId}::uuid and question_key=${input.questionKey} for share`,
    );
    if (!origin) throw new KnowledgeError("not_found", 404, "Offered question unavailable");
    const [latest] = await tx.execute<{ sitting: number }>(
      sql`select coalesce(max(coalesce(sitting,1)),1)::int as sitting from artist_interview_answers where artist_id=${artistId}::uuid`,
    );
    if (!latest) throw new Error("Sitting unavailable");
    if (input.scope === "sitting" && origin.sitting < latest.sitting)
      throw new KnowledgeError(
        "sitting_changed",
        409,
        "This sitting has ended; review the scope before saving",
      );
    const [count] = await tx.execute<{ n: number }>(
      sql`select count(*)::int as n from artist_interview_boundaries where artist_id=${artistId}::uuid and retracted_at is null and (scope='until_retracted' or sitting>=${latest.sitting})`,
    );
    if (!count || count.n >= 50)
      throw new KnowledgeError(
        "memory_limit",
        413,
        "Review existing active instructions before adding another",
      );
    const activityId = await recordArtistActivity(
      artistId,
      "interview_boundary_created",
      { userId, trigger: "explicit_interview_boundary" },
      tx,
    );
    const [saved] = await tx.execute<BoundaryRow>(
      sql`insert into artist_interview_boundaries(artist_id,request_id,wording,scope,sitting,origin_answer_id,origin_question_key,origin_question,created_by,activity_id)values(${artistId}::uuid,${input.requestId}::uuid,${input.wording},${input.scope},${origin.sitting},${origin.id}::uuid,${input.questionKey},${origin.question},${userId}::uuid,${activityId}::uuid) returning *`,
    );
    if (!saved) throw new Error("Boundary was not persisted");
    return { status: "ok" as const, boundary: toInterviewBoundary(saved) };
  });
}
