import { generateText } from "@/lib/ai/generateText";
import { withTimeout } from "@/lib/async/withTimeout";
import { ACK_FALLBACKS, ACK_TIMEOUT_MS } from "@/lib/onboarding/const";
import { containsMemoryOrApologyLanguage } from "@/lib/onboarding/containsMemoryOrApologyLanguage";
import { interviewAckPrompt } from "@/lib/onboarding/interviewAckPrompt";

/**
 * One warm sentence reacting to an interview answer, bounded at 5 s. Any
 * failure, or a reply claiming memory or apologising, uses a fallback line,
 * rotated by the question's position so a run of misses never repeats.
 *
 * @param question - The question asked.
 * @param answer - The artist's answer.
 * @param questionIndex - This question's 0-based position in the interview.
 * @returns The line to show.
 */
export async function generateInterviewAck(
  question: string,
  answer: string,
  questionIndex: number,
): Promise<string> {
  const fallback = ACK_FALLBACKS[questionIndex % ACK_FALLBACKS.length];
  try {
    const response = await withTimeout(
      generateText({
        prompt: interviewAckPrompt(question, answer),
        temperature: 0.7,
        // Thinking burns ~1.5 s on a one-line reply, enough to lose the race.
        thinkingBudget: 0,
      }),
      ACK_TIMEOUT_MS,
      "ack timeout",
    );
    const text = response.text?.trim();
    if (!text || containsMemoryOrApologyLanguage(text)) return fallback;
    return text;
  } catch {
    return fallback;
  }
}
