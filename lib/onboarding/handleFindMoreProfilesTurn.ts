import { applyProfileLinkDecisions } from "@/lib/onboarding/applyProfileLinkDecisions";
import { TURN_MESSAGES } from "@/lib/onboarding/const";
import { emitStep } from "@/lib/onboarding/emitStep";
import { guardTurnStep } from "@/lib/onboarding/guardTurnStep";
import { linkFailureMessages } from "@/lib/onboarding/linkFailureMessages";
import type { ClientTurn, TurnContext, TurnEvent } from "@/lib/onboarding/types";

/**
 * "Look for more" on the profiles card. Saves what the artist already decided
 * before re-searching, so their confirmations and removals aren't lost and the
 * card re-renders from the database.
 *
 * @param ctx - The turn's context.
 * @param turn - The turn, with optional decisions (an older client sends none).
 * @returns The turn's events.
 */
export async function* handleFindMoreProfilesTurn(
  ctx: TurnContext,
  turn: Extract<ClientTurn, { type: "find_more_profiles" }>,
): AsyncGenerator<TurnEvent> {
  if (!(yield* guardTurnStep(ctx, "profiles", TURN_MESSAGES.pastProfiles))) return;
  const outcome = await applyProfileLinkDecisions(
    ctx.artistId,
    turn.addedLinks ?? [],
    turn.removedSiteNames ?? [],
  );
  yield* linkFailureMessages(outcome, true);
  yield* emitStep(ctx.artistId, "profiles", { discoverProfiles: true });
}
