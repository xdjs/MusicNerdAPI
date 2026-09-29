import { NARRATION } from "@/lib/onboarding/const";
import { emitStep } from "@/lib/onboarding/emitStep";
import { runAutoBuild } from "@/lib/onboarding/runAutoBuild";
import type { TurnContext, TurnEvent } from "@/lib/onboarding/types";

/**
 * The chat opening. A fresh claim builds the page outright; a resume (something
 * failed, or they stepped away) goes back in with the step-by-step card.
 *
 * @param ctx - The turn's context.
 * @returns The turn's events.
 */
export async function* handleOpenTurn(ctx: TurnContext): AsyncGenerator<TurnEvent> {
  const { artistId, state } = ctx;
  if (state.complete || state.currentStep === null) {
    yield { kind: "chat", text: NARRATION.alreadyDone };
    yield { kind: "complete" };
    return;
  }
  if (state.currentStep === "profiles") {
    yield* runAutoBuild(artistId, ctx.ownership);
    return;
  }
  yield { kind: "chat", text: NARRATION.welcomeBack };
  yield* emitStep(artistId, state.currentStep);
}
