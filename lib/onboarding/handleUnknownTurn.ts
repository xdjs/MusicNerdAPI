import { NARRATION, TURN_MESSAGES } from "@/lib/onboarding/const";
import { emitStep } from "@/lib/onboarding/emitStep";
import type { TurnContext, TurnEvent } from "@/lib/onboarding/types";

/**
 * A turn type we don't handle: say so and re-show the current step.
 *
 * @param ctx - The turn's context.
 * @returns The turn's events.
 */
export async function* handleUnknownTurn(ctx: TurnContext): AsyncGenerator<TurnEvent> {
  if (ctx.state.currentStep === null) {
    yield { kind: "chat", text: NARRATION.alreadyDone };
    yield { kind: "complete" };
    return;
  }
  yield { kind: "error", message: TURN_MESSAGES.unknownTurn };
  yield* emitStep(ctx.artistId, ctx.state.currentStep);
}
