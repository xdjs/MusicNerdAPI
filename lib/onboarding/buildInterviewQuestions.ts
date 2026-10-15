import { withAbortDeadline } from "@/lib/async/withAbortDeadline";
import { INTERVIEW_QUESTION_CAP, ONBOARDING_QUESTIONS } from "@/lib/onboarding/const";
import type { InterviewQuestionCandidate } from "@/lib/onboarding/types";
import { generateGroundedQuestions } from "@/lib/questions/generateGroundedQuestions";

/** Prepare one bounded set from saved material; never wait for a scrape or repeat a saved key. */
export async function buildInterviewQuestions(
  artistId: string,
  answeredKeys: string[] = [],
): Promise<InterviewQuestionCandidate[]> {
  const seen = new Set(answeredKeys);
  const remaining = Math.max(0, INTERVIEW_QUESTION_CAP - seen.size);
  if (!remaining) return [];
  let grounded: InterviewQuestionCandidate[] = [];
  try {
    grounded = await withAbortDeadline(
      abortSignal =>
        generateGroundedQuestions(artistId, { max: INTERVIEW_QUESTION_CAP, abortSignal }),
      15_000,
    );
  } catch {
    console.warn(
      "[onboarding] interview preparation unavailable; using optional general questions",
    );
  }
  const questions: InterviewQuestionCandidate[] = [];
  const wording = new Set<string>();
  for (const q of [...grounded, ...ONBOARDING_QUESTIONS.map(q => ({ ...q, sourceUrls: [] }))]) {
    const text = q.question.trim().toLowerCase();
    if (seen.has(q.key) || wording.has(text)) continue;
    seen.add(q.key);
    wording.add(text);
    questions.push({ key: q.key, question: q.question, sourceUrls: q.sourceUrls });
    if (questions.length === remaining) break;
  }
  return questions;
}
