import { getArtistById } from "@/lib/artists/getArtistById";
import { PROFILE_DISPLAY_COLUMNS } from "@/lib/links/const";
import { applyProfileLinkDecisions } from "@/lib/onboarding/applyProfileLinkDecisions";
import { buildRoutedToVaultOwnedMessage } from "@/lib/onboarding/buildRoutedToVaultOwnedMessage";
import { buildRoutedToVaultPendingMessage } from "@/lib/onboarding/buildRoutedToVaultPendingMessage";
import { confirmOnboardingStep } from "@/lib/onboarding/confirmOnboardingStep";
import { NARRATION, TURN_MESSAGES } from "@/lib/onboarding/const";
import { emitStep } from "@/lib/onboarding/emitStep";
import { guardTurnStep } from "@/lib/onboarding/guardTurnStep";
import { linkFailureMessages } from "@/lib/onboarding/linkFailureMessages";
import type { ClientTurn, TurnContext, TurnEvent } from "@/lib/onboarding/types";
import { queueSocialIngest } from "@/lib/research/queueSocialIngest";

/**
 * Confirms the profiles card. Success is read back from the artist's row, not
 * inferred from the request: if every pasted link failed and they still have
 * none, the step is re-shown rather than confirmed over an empty profile.
 * Otherwise the Instagram scrape is queued (it runs during the vault step, ready
 * for the interview) and the vault step starts, forcing a web search when this
 * turn itself routed a source in.
 *
 * @param ctx - The turn's context.
 * @param turn - The turn, with the artist's decisions.
 * @returns The turn's events.
 */
export async function* handleConfirmProfilesTurn(
  ctx: TurnContext,
  turn: Extract<ClientTurn, { type: "confirm_profiles" }>,
): AsyncGenerator<TurnEvent> {
  const { artistId } = ctx;
  if (!(yield* guardTurnStep(ctx, "profiles", TURN_MESSAGES.notYet))) return;
  const addedLinks = turn.addedLinks ?? [];
  const outcome = await applyProfileLinkDecisions(
    artistId,
    addedLinks,
    turn.removedSiteNames ?? [],
  );
  const linkRecord = ((await getArtistById(artistId)) ?? {}) as Record<string, unknown>;
  const hasAtLeastOneLink = PROFILE_DISPLAY_COLUMNS.some(col => {
    const value = linkRecord[col];
    return typeof value === "string" && value.length > 0;
  });
  const failed =
    outcome.unrecognized.length + outcome.writeRejected.length + outcome.vaultInsertFailed.length;
  if (addedLinks.length > 0 && failed === addedLinks.length && !hasAtLeastOneLink) {
    yield* linkFailureMessages(outcome, true);
    yield { kind: "chat", text: TURN_MESSAGES.profilesRetryNudge };
    yield* emitStep(artistId, "profiles");
    return;
  }

  await confirmOnboardingStep(artistId, "profiles");
  await queueSocialIngest(artistId, {});
  yield* linkFailureMessages(outcome, false);
  if (outcome.routedToVaultApproved.length > 0)
    yield { kind: "chat", text: buildRoutedToVaultOwnedMessage(outcome.routedToVaultApproved) };
  if (outcome.routedToVaultPending.length > 0)
    yield { kind: "chat", text: buildRoutedToVaultPendingMessage(outcome.routedToVaultPending) };
  yield { kind: "chat", text: NARRATION.profilesDone };
  yield* emitStep(artistId, "vault", {
    forceVaultDiscovery:
      outcome.routedToVaultApproved.length + outcome.routedToVaultPending.length > 0,
  });
}
