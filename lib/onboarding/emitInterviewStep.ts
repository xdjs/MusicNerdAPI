import { getInterviewAnswers } from "@/lib/lore/getInterviewAnswers";
import { buildInterviewQuestions } from "@/lib/onboarding/buildInterviewQuestions";
import { confirmOnboardingStep } from "@/lib/onboarding/confirmOnboardingStep";
import { INTERVIEW_QUESTION_CAP } from "@/lib/onboarding/const";
import { emitPublishStep } from "@/lib/onboarding/emitPublishStep";
import type { InterviewQuestionCandidate, TurnEvent } from "@/lib/onboarding/types";

/**
 * The next interview question, or, once three have been asked (answered or
 * skipped), the interview is confirmed and the publish step starts. The
 * question's number comes from how many were asked, not its position, so it
 * stays monotonic when a regeneration reorders the rest.
 *
 * @param artistId - The artist.
 * @returns The step's events.
 */
export async function* emitInterviewStep(artistId: string): AsyncGenerator<TurnEvent> {
  const asked = new Set(((await getInterviewAnswers(artistId)) ?? []).map(a => a.questionKey));
  let questions: InterviewQuestionCandidate[] = [];
  if (asked.size < INTERVIEW_QUESTION_CAP) {
    // Reading their posts can take ~12 s of real work: narrated, not dead air.
    yield { kind: "progress", label: "Reading your posts", done: false };
    questions = await buildInterviewQuestions(artistId);
    yield { kind: "progress", label: "Reading your posts", done: true };
  }
  const next = questions.find(q => !asked.has(q.key));
  if (!next) {
    await confirmOnboardingStep(artistId, "interview");
    yield* emitPublishStep(artistId);
    return;
  }
  yield { kind: "chat", text: next.question };
  yield {
    kind: "step",
    step: "interview",
    payload: {
      questionKey: next.key,
      question: next.question,
      number: asked.size + 1,
      total: INTERVIEW_QUESTION_CAP,
      sourceUrls: next.sourceUrls,
    },
  };
}
