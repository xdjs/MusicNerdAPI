import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { toInterviewQuestion } from "./toInterviewQuestion";
import type { QuestionRow, SessionRow } from "./types";
/** Read bounded saved state only; caller authenticates in this transaction. */
export async function readInterviewSessionState(
  tx: TransactionDb,
  artistId: string,
  sessionId?: string,
) {
  const [row] = await tx.execute<SessionRow>(
    sql`select * from artist_interview_sessions where artist_id=${artistId}::uuid ${sessionId ? sql`and id=${sessionId}::uuid` : sql``} order by sitting desc limit 1`,
  );
  if (sessionId && !row)
    throw new KnowledgeError("not_found", 404, "Interview session unavailable");
  const questions = row
    ? await tx.execute<QuestionRow>(
        sql`select a.*,e.ordinal,e.evidence_references from artist_interview_question_evidence e join artist_interview_answers a on a.id=e.answer_id and a.artist_id=e.artist_id where e.session_id=${row.id}::uuid and e.artist_id=${artistId}::uuid order by e.ordinal limit 4`,
      )
    : [];
  const legacy = await tx.execute<QuestionRow>(
    sql`select a.* from artist_interview_answers a where a.artist_id=${artistId}::uuid and a.source='offered' and not exists(select 1 from artist_interview_question_evidence e where e.answer_id=a.id) order by a.offered_at,a.id limit 4`,
  );
  if (questions.length > 3 || legacy.length > 3)
    throw new KnowledgeError(
      "interview_limit",
      413,
      "Interview state exceeds the supported offer limit",
    );
  return {
    status: "ok" as const,
    session: row
      ? {
          id: row.id,
          sitting: row.sitting,
          state: row.state,
          createdAt: new Date(row.created_at).toISOString(),
          closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
          questions: questions.map(toInterviewQuestion),
        }
      : null,
    legacyOffers: legacy.map(toInterviewQuestion),
  };
}
