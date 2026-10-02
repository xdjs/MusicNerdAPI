import { MAX_CLIENT_QUESTION_CHARS, ONBOARDING_QUESTIONS } from "@/lib/onboarding/const";
import { GROUNDED_QUESTION_KEY_PREFIX } from "@/lib/questions/const";

/**
 * The question text to store with an answer. A static key is looked up here
 * and the client's text ignored. A grounded key has no bank to check against
 * (regenerating would cost a model call per answer), so its text is trusted
 * from the client, as publish trusts the doc; the route is gated by `canEditArtist`.
 *
 * @param questionKey - The question's key.
 * @param clientQuestion - The text the client showed.
 * @returns The text, or null for an unknown key or an empty grounded question.
 */
export function resolveInterviewQuestionText(
  questionKey: string,
  clientQuestion: string | undefined,
): string | null {
  const staticQuestion = ONBOARDING_QUESTIONS.find(q => q.key === questionKey);
  if (staticQuestion) return staticQuestion.question;
  if (questionKey.startsWith(GROUNDED_QUESTION_KEY_PREFIX)) {
    const text =
      typeof clientQuestion === "string"
        ? clientQuestion.trim().slice(0, MAX_CLIENT_QUESTION_CHARS)
        : "";
    return text || null;
  }
  return null;
}
