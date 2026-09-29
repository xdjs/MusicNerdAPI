import { runOnboardingTurnInternal } from "@/lib/onboarding/runOnboardingTurnInternal";
import type { ClientTurn, TurnEvent, TurnOwnership } from "@/lib/onboarding/types";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";

/**
 * Runs a chat turn inside the artist operation. The claim check lives in
 * async context, and a generator's body runs in whatever context calls
 * `next()`, so every `next()` (and the closing `return()`) is made inside the
 * operation. Nothing the turn does between yields writes without the check.
 *
 * @param artistId - The artist.
 * @param turn - The client's turn.
 * @param ownership - The user and claim the turn runs under.
 * @returns The turn's events.
 */
export async function* runOnboardingTurn(
  artistId: string,
  turn: ClientTurn,
  ownership: TurnOwnership,
): AsyncGenerator<TurnEvent> {
  const operation = { ...ownership, trigger: "onboarding" };
  const iterator = runOnboardingTurnInternal(artistId, turn, ownership);
  try {
    for (;;) {
      const result = await withArtistOperation(artistId, operation, () => iterator.next());
      if (result.done) return;
      yield result.value;
    }
  } finally {
    await withArtistOperation(artistId, operation, () => iterator.return(undefined));
  }
}
