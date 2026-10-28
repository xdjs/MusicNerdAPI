import { generateObject } from "@/lib/ai/generateObject";
import { answerVerdictSchema, type AnswerVerdict } from "@/lib/evals/answerVerdictSchema";

const INSTRUCTIONS = `You grade answers to a fan's question about a music artist. Score two numbers from 0 to 1.
relevance: does the answer address the question asked (1), partly (0.5), or not at all (0)?
groundedness: does every factual claim agree with the hand-checked reference? Penalise claims that contradict it or that it does not support. When the reference says the stored sources cannot answer, an answer that plainly says it could not find the information is fully grounded (1) and an answer that states a specific fact anyway is not (0).
Ignore citation markers such as [1]; they are scored elsewhere. Give a one-sentence reason.`;

/**
 * The chat suite's answer-quality judge: one structured call through the gateway on the
 * wrapper's default model, so judge spend lands in the same budget as production
 * (MusicNerdWeb `docs/evals.md`).
 *
 * @param input - The case and the answer under test.
 * @param input.question - The fan's question.
 * @param input.reference - The hand-checked facts the answer should agree with.
 * @param input.answerable - False when the stored sources cannot answer the question.
 * @param input.answer - The answer text.
 * @returns The judge's verdict; an empty answer scores 0 without a model call.
 */
export async function judgeAnswer(input: {
  question: string;
  reference: string;
  answerable: boolean;
  answer: string;
}): Promise<AnswerVerdict> {
  if (!input.answer.trim())
    return { relevance: 0, groundedness: 0, reason: "The answer is empty." };
  const result = await generateObject({
    instructions: INSTRUCTIONS,
    schema: answerVerdictSchema,
    temperature: 0,
    prompt: [
      `Question: ${input.question}`,
      `Reference${input.answerable ? "" : " (the stored sources cannot answer this question)"}: ${input.reference}`,
      `Answer: ${input.answer || "(empty)"}`,
    ].join("\n\n"),
  });
  return result.output;
}
