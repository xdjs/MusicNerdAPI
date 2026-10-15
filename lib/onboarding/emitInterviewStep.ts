import { getInterviewAnswers } from "@/lib/lore/getInterviewAnswers";
import { getOnboardingInterviewPlan } from "@/lib/onboarding/getOnboardingInterviewPlan";
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
  const history = await getInterviewAnswers(artistId);
  if (history === null) {
    yield { kind: "error", message: "We couldn't load your saved interview. Please try again." };
    return;
  }
  const asked = new Set(history.map(a => a.questionKey));
  let questions: InterviewQuestionCandidate[] = [];
  if (asked.size < INTERVIEW_QUESTION_CAP) {
    // The same private plan survives skips, reloads and new server instances.
    yield { kind: "progress", label: "Preparing your questions…", done: false };
    questions = await getOnboardingInterviewPlan(artistId, [...asked]);
    yield { kind: "progress", label: "Preparing your questions…", done: true };
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
