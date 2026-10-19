import { FatalError } from "workflow";
import type { TurnEvent, TurnOwnership } from "@/lib/onboarding/types";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Runs one auto-build stage to its end with nobody listening. Every `next()`
 * is made inside the artist operation, as a chat turn does, so each write the
 * stage makes re-checks the claim. Its events are dropped: the page watches
 * the onboarding state instead.
 *
 * @param artistId - The artist.
 * @param ownership - The claimant and claim the build runs under.
 * @param stage - The stage's event generator.
 * @returns What the stage returns.
 * @throws The stage's `error` event as an Error, so the step retries; a FatalError once the claim changed.
 */
export async function drainBuildStage<T>(
  artistId: string,
  ownership: TurnOwnership,
  stage: AsyncGenerator<TurnEvent, T>,
): Promise<T> {
  const operation = { ...ownership, trigger: "onboarding" };
  try {
    for (;;) {
      const result = await withArtistOperation(artistId, operation, () => stage.next());
      if (result.done) return result.value;
      if (result.value.kind === "error") throw new Error(result.value.message);
    }
  } catch (e) {
    if (e instanceof OwnershipChangedError) throw new FatalError(e.message);
    throw e;
  } finally {
    await withArtistOperation(artistId, operation, () => stage.return(undefined as T));
  }
}
