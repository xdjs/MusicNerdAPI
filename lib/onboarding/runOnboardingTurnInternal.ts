import { getOnboardingState } from "@/lib/onboarding/getOnboardingState";
import { handleAboutChoiceTurn } from "@/lib/onboarding/handleAboutChoiceTurn";
import { handleConfirmProfilesTurn } from "@/lib/onboarding/handleConfirmProfilesTurn";
import { handleFindMoreProfilesTurn } from "@/lib/onboarding/handleFindMoreProfilesTurn";
import { handleInterviewAnswerTurn } from "@/lib/onboarding/handleInterviewAnswerTurn";
import { handleOpenTurn } from "@/lib/onboarding/handleOpenTurn";
import { handlePublishTurn } from "@/lib/onboarding/handlePublishTurn";
import { handleUnknownTurn } from "@/lib/onboarding/handleUnknownTurn";
import { handleVaultReviewTurn } from "@/lib/onboarding/handleVaultReviewTurn";
import { TURN_MESSAGES } from "@/lib/onboarding/const";
import type { ClientTurn, TurnContext, TurnEvent, TurnOwnership } from "@/lib/onboarding/types";

/**
 * One chat turn. The server owns the step sequence: the current step is
 * derived from the confirmations, and every handler is idempotent, so a re-run
 * after a disconnect continues rather than double-acts. An unreadable state is
 * unknown, not incomplete: nothing is written and the next turn retries.
 *
 * @param artistId - The artist.
 * @param turn - The client's turn.
 * @param ownership - The user and claim the turn runs under.
 * @returns The turn's events.
 */
export async function* runOnboardingTurnInternal(
  artistId: string,
  turn: ClientTurn,
  ownership: TurnOwnership,
): AsyncGenerator<TurnEvent> {
  const state = await getOnboardingState(artistId);
  if (state === null) {
    yield { kind: "error", message: TURN_MESSAGES.stateUnavailable };
    return;
  }
  const ctx: TurnContext = { artistId, ownership, state };
  switch (turn.type) {
    case "open":
      return yield* handleOpenTurn(ctx);
    case "find_more_profiles":
      return yield* handleFindMoreProfilesTurn(ctx, turn);
    case "confirm_profiles":
      return yield* handleConfirmProfilesTurn(ctx, turn);
    case "vault_review":
      return yield* handleVaultReviewTurn(ctx, turn);
    case "interview_answer":
      return yield* handleInterviewAnswerTurn(ctx, turn);
    case "about_choice":
      return yield* handleAboutChoiceTurn(ctx, turn);
    case "publish":
      return yield* handlePublishTurn(ctx, turn);
    default:
      return yield* handleUnknownTurn(ctx);
  }
}
