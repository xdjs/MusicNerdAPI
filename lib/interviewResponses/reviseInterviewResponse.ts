import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistInterviewAnswers, artistInterviewAnswerVersions } from "@/lib/db/schema";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { recordArtistActivity } from "@/lib/activity/recordArtistActivity";
import { authorizeArtistKnowledge } from "@/lib/knowledge/authorizeArtistKnowledge";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { queueLoreRefresh } from "@/lib/research/queueLoreRefresh";
import { assertInterviewResponseBudget } from "./assertInterviewResponseBudget";
import { toInterviewResponse } from "./toInterviewResponse";
import { validateInterviewResponseBody } from "./validateInterviewResponseBody";

/** Save exact revised wording, both versions, attribution and refresh in one authorized transaction. */
export async function reviseInterviewResponse(
  artistId: string,
  userId: string,
  answerId: string,
  body: unknown,
) {
  const input = validateInterviewResponseBody(body);
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeArtistKnowledge(tx, artistId, userId);
    const [row] = await tx
      .select()
      .from(artistInterviewAnswers)
      .where(
        and(eq(artistInterviewAnswers.artistId, artistId), eq(artistInterviewAnswers.id, answerId)),
      )
      .limit(1)
      .for("update");
    if (!row) throw new KnowledgeError("not_found", 404, "Saved response unavailable");
    const original = toInterviewResponse(row);
    if (original.answer === input.answer)
      return { status: "ok" as const, response: original, isCurrent: true };
    if (original.revision !== input.expectedRevision)
      throw new KnowledgeError(
        "answer_changed",
        409,
        "This response changed. Reload the saved response before editing again.",
      );
    await tx
      .insert(artistInterviewAnswerVersions)
      .values({
        answerId,
        artistId,
        revision: original.revision,
        snapshot: row,
        note: null,
        actorUserId: null,
      })
      .onConflictDoNothing();
    const [saved] = await tx
      .update(artistInterviewAnswers)
      .set({ answer: input.answer, createdAt: sql`clock_timestamp()` })
      .where(
        and(eq(artistInterviewAnswers.artistId, artistId), eq(artistInterviewAnswers.id, answerId)),
      )
      .returning();
    const response = toInterviewResponse(saved);
    await tx.insert(artistInterviewAnswerVersions).values({
      answerId,
      artistId,
      revision: response.revision,
      snapshot: saved,
      note: input.note || null,
      actorUserId: userId,
    });
    await assertInterviewResponseBudget(tx, artistId, answerId);
    await recordArtistActivity(
      artistId,
      "interview_response_revised",
      { userId, trigger: "interview_response_edit", sourceId: answerId },
      tx,
    );
    const claim = await findApprovedClaim(tx, artistId);
    await withArtistOperation(
      artistId,
      { userId, expectedClaimId: claim?.id ?? null, trigger: "interview_response_edit" },
      () => queueLoreRefresh(artistId, claim?.id ?? null, undefined, tx),
    );
    return { status: "ok" as const, response, isCurrent: true };
  });
}
