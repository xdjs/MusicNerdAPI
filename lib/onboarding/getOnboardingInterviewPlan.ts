import { sql } from "drizzle-orm";
import { z } from "zod";
import { rowsOf } from "@/lib/db/rowsOf";
import { buildInterviewQuestions } from "@/lib/onboarding/buildInterviewQuestions";
import type { InterviewQuestionCandidate } from "@/lib/onboarding/types";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";

const schema = z
  .array(
    z.object({
      key: z.string().min(1),
      question: z.string().min(1).max(500),
      sourceUrls: z.array(z.url()),
    }),
  )
  .min(1)
  .max(3)
  .refine(questions => new Set(questions.map(q => q.key)).size === questions.length);

/** Restore a claim-scoped plan, or prepare outside locks and adopt the first saved plan. */
export async function getOnboardingInterviewPlan(
  artistId: string,
  answeredKeys: string[],
): Promise<InterviewQuestionCandidate[]> {
  const scope = getArtistOperationOwnership(artistId);
  if (!scope?.userId)
    throw new Error("Interview preparation requires an authorized artist operation");
  const claimId = scope.expectedClaimId;
  const read = async () =>
    withScopedArtistWrite(artistId, async tx => {
      const [row] = rowsOf(
        await tx.execute(sql`
      select questions from artist_onboarding_interview_plans
      where artist_id=${artistId}::uuid and claim_id is not distinct from ${claimId}::uuid`),
      ) as { questions: unknown }[];
      return row ? schema.parse(row.questions) : null;
    });
  const existing = await read();
  if (existing) return existing;
  const questions = schema.parse(await buildInterviewQuestions(artistId, answeredKeys));
  return withScopedArtistWrite(artistId, async tx => {
    await tx.execute(sql`
      insert into artist_onboarding_interview_plans(artist_id,claim_id,questions)
      values(${artistId}::uuid,${claimId}::uuid,${JSON.stringify(questions)}::text::jsonb)
      on conflict(artist_id) do update set claim_id=excluded.claim_id,questions=excluded.questions,created_at=clock_timestamp()
      where artist_onboarding_interview_plans.claim_id is distinct from excluded.claim_id`);
    const [saved] = rowsOf(
      await tx.execute(sql`
      select questions from artist_onboarding_interview_plans
      where artist_id=${artistId}::uuid and claim_id is not distinct from ${claimId}::uuid`),
    ) as { questions: unknown }[];
    return schema.parse(saved?.questions);
  });
}
