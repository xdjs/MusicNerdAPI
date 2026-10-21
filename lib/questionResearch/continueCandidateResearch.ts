import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { callResearchOperation } from "@/lib/questionResearch/callResearchOperation";
import { continueQuestionResearch } from "@/lib/questionResearch/continueQuestionResearch";
import { getResearchQuestionHash } from "@/lib/questionResearch/getResearchQuestionHash";
import { researchStatusSchema } from "@/lib/questionResearch/publicQuestionSchemas";

/** A checked candidate miss advances its existing job; retries share the same transition. */
export async function continueCandidateResearch(input: {
  artistId: string;
  jobId: string;
  question: string;
  signal?: AbortSignal;
}) {
  const token = randomUUID();
  const questionHash = getResearchQuestionHash(input.question);
  const [claimed] = await db.execute<{ job_id: string }>(sql`
    update artist_question_answers
    set claim_token=${token}::uuid,claim_until=now()+interval '70 seconds',
      failure_stage='candidate_continuation',updated_at=now()
    where job_id=${input.jobId}::uuid and artist_id=${input.artistId}::uuid
      and question_hash=${questionHash} and status='verified'
      and result->'sources'='[]'::jsonb and expires_at>now()
      and (failure_stage is distinct from 'candidate_continuation' or claim_until<=now())
    returning job_id`);
  if (!claimed) return { pending: true as const };
  try {
    const state = researchStatusSchema.parse(
      await callResearchOperation(() =>
        continueQuestionResearch(input.artistId, input.jobId, { kind: "service" }),
      ),
    );
    if (state.jobId !== input.jobId || state.selection !== "research")
      throw new Error("Research continuation did not preserve its job");
    const released = await db.execute<{ job_id: string }>(sql`
      update artist_question_answers
      set status='waiting',result=null,failure_stage=null,claim_until=now(),updated_at=now()
      where job_id=${input.jobId}::uuid and artist_id=${input.artistId}::uuid
        and question_hash=${questionHash} and claim_token=${token}::uuid
        and failure_stage='candidate_continuation' and status='verified'
        and expires_at>now()
      returning job_id`);
    return released.length ? state : { pending: true as const };
  } finally {
    // An uncertain outcome retains the marker: the next request retries the
    // idempotent transition, never returns the old candidate limitation.
    await db.execute(sql`update artist_question_answers set claim_until=now()
      where job_id=${input.jobId}::uuid and artist_id=${input.artistId}::uuid
        and question_hash=${questionHash} and claim_token=${token}::uuid
        and failure_stage='candidate_continuation'`);
  }
}
