import { Output } from "ai";
import { z } from "zod";
import { generateInterviewText } from "./generateInterviewText";
import {
  SPOKEN_QUESTION_CHECK_INSTRUCTIONS,
  spokenQuestionCheckSchema,
} from "./checkSpokenQuestion";
import { resolveInterviewAnchors } from "./resolveInterviewAnchors";
import { MODEL_INTERVIEW_CHECKER } from "./models";
import type { prepareArtistQuestion } from "./prepareArtistQuestion";
/** Share mandatory context once while judging every independent question and its exact evidence. */
export async function checkSpokenInterviewBank(
  draft: NonNullable<Awaited<ReturnType<typeof prepareArtistQuestion>>>,
  memory: Parameters<typeof prepareArtistQuestion>[0],
  previousQuestions: Parameters<typeof prepareArtistQuestion>[1],
  signal: AbortSignal,
) {
  const questions = draft.candidates.map((candidate, index) => {
    const evidence = resolveInterviewAnchors(candidate.references, draft.originals, memory, []);
    return {
      index,
      question: candidate.question,
      evidence,
      openedOriginals: draft.originals.filter(original =>
        evidence.some(item => item.source?.sourceId === original.passage.source.sourceId),
      ),
    };
  });
  const result = await generateInterviewText({
    model: MODEL_INTERVIEW_CHECKER,
    instructions: `${SPOKEN_QUESTION_CHECK_INSTRUCTIONS}\nJudge each indexed question independently using its own exact evidence. Also compare all questions in this batch: semantically overlapping asks fail novelty; distinct unknowns about the same source can pass. Return exactly one verdict for each index, preserving index order. Never average safety across questions.`,
    prompt: JSON.stringify({
      asOf: new Date().toISOString().slice(0, 10),
      mandatoryMemory: memory,
      previousQuestions,
      questions,
    }),
    output: Output.object({
      schema: z.object({
        checks: z
          .array(spokenQuestionCheckSchema.extend({ index: z.number().int() }))
          .length(questions.length),
      }),
    }),
    thinkingLevel: "low",
    maxOutputTokens: 3000,
    maxRetries: 0,
    abortSignal: signal,
  });
  if (result.output.checks.some((check, index) => check.index !== index))
    throw new Error("Interview bank check indices do not match candidates");
  return {
    checks: result.output.checks.map(check => spokenQuestionCheckSchema.parse(check)),
    usage: result.usage,
  };
}
