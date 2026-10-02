import { buildUnrecognizedLinksMessage } from "@/lib/onboarding/buildUnrecognizedLinksMessage";
import { buildVaultInsertFailedMessage } from "@/lib/onboarding/buildVaultInsertFailedMessage";
import { buildWriteRejectedLinksMessage } from "@/lib/onboarding/buildWriteRejectedLinksMessage";
import type { ProfileLinkOutcome, TurnEvent } from "@/lib/onboarding/types";

/**
 * The chat lines for links that failed, one per failure kind, in MusicNerdWeb's order.
 *
 * @param outcome - What applying the decisions produced.
 * @param blocked - The profiles step is being re-shown, so invite another paste.
 * @returns The chat events; empty when nothing failed.
 */
export function linkFailureMessages(outcome: ProfileLinkOutcome, blocked: boolean): TurnEvent[] {
  const events: TurnEvent[] = [];
  if (outcome.unrecognized.length > 0)
    events.push({
      kind: "chat",
      text: buildUnrecognizedLinksMessage(outcome.unrecognized, blocked),
    });
  if (outcome.writeRejected.length > 0)
    events.push({
      kind: "chat",
      text: buildWriteRejectedLinksMessage(outcome.writeRejected, blocked),
    });
  if (outcome.vaultInsertFailed.length > 0)
    events.push({ kind: "chat", text: buildVaultInsertFailedMessage(outcome.vaultInsertFailed) });
  return events;
}
