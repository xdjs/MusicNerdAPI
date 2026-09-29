import { getInterviewAnswers } from "@/lib/lore/getInterviewAnswers";
import { TURN_MESSAGES } from "@/lib/onboarding/const";
import { emitStep } from "@/lib/onboarding/emitStep";
import { generateInterviewAck } from "@/lib/onboarding/generateInterviewAck";
import { guardTurnStep } from "@/lib/onboarding/guardTurnStep";
import { resolveInterviewQuestionText } from "@/lib/onboarding/resolveInterviewQuestionText";
import type { ClientTurn, TurnContext, TurnEvent } from "@/lib/onboarding/types";
import { upsertInterviewAnswer } from "@/lib/onboarding/upsertInterviewAnswer";

/**
 * Stores an interview answer (null for a skip), acknowledges a real one, and
 * asks the next question. Answered or skipped questions are never re-asked.
 *
 * @param ctx - The turn's context.
 * @param turn - The turn, with the question key, the answer and the question text shown.
 * @returns The turn's events.
 */
export async function* handleInterviewAnswerTurn(
  ctx: TurnContext,
  turn: Extract<ClientTurn, { type: "interview_answer" }>,
): AsyncGenerator<TurnEvent> {
  const { artistId } = ctx;
  if (!(yield* guardTurnStep(ctx, "interview", TURN_MESSAGES.notYet))) return;
  const questionText = resolveInterviewQuestionText(turn.questionKey, turn.question);
  if (questionText === null) {
    yield { kind: "error", message: TURN_MESSAGES.unknownQuestion };
    yield* emitStep(artistId, "interview");
    return;
  }
  const answer = turn.answer?.trim() || null;
  // How many were asked before this one: its position, for a non-repeating fallback.
  const priorAnswers = (await getInterviewAnswers(artistId)) ?? [];
  await upsertInterviewAnswer({
    artistId,
    questionKey: turn.questionKey,
    question: questionText,
    answer,
    // The onboarding interview is the first sitting by definition.
    sitting: 1,
    source: "onboarding",
  });
  if (answer) {
    yield {
      kind: "chat",
      text: await generateInterviewAck(questionText, answer, priorAnswers.length),
    };
  }
  yield* emitStep(artistId, "interview");
}
