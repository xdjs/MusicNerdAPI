import { NARRATION } from "@/lib/onboarding/const";
import { emitStep } from "@/lib/onboarding/emitStep";
import type { OnboardingStep, TurnContext, TurnEvent } from "@/lib/onboarding/types";

/**
 * Gates a turn on the derived current step, so a stale card (a second tab on
 * a confirmed step) can't write out of order: once onboarding is done it just
 * completes; on the wrong step it says so and re-shows the real one.
 *
 * @param ctx - The turn's context.
 * @param step - The step this turn belongs to.
 * @param wrongStepMessage - What to say when the artist is on another step.
 * @returns The guard's events; its return value is whether the turn may proceed.
 */
export async function* guardTurnStep(
  ctx: TurnContext,
  step: OnboardingStep,
  wrongStepMessage: string,
): AsyncGenerator<TurnEvent, boolean> {
  const current = ctx.state.currentStep;
  if (current === null) {
    yield { kind: "chat", text: NARRATION.alreadyDone };
    yield { kind: "complete" };
    return false;
  }
  if (current !== step) {
    yield { kind: "error", message: wrongStepMessage };
    yield* emitStep(ctx.artistId, current);
    return false;
  }
  return true;
}
