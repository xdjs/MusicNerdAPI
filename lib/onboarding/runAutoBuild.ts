import { emitVaultStep } from "@/lib/onboarding/emitVaultStep";
import { autoBuildProfiles } from "@/lib/onboarding/autoBuildProfiles";
import { autoBuildSources } from "@/lib/onboarding/autoBuildSources";
import { NARRATION } from "@/lib/onboarding/const";
import type { TurnEvent, TurnOwnership } from "@/lib/onboarding/types";

/**
 * Discovers a fresh claimant's profile, then hands pending sources to the artist
 * for explicit review. Claim approval establishes editing rights, not consent
 * to approve sources or publish a generated About.
 *
 * @param artistId - The artist.
 * @param ownership - The user and claim the turn runs under.
 * @returns The build's events.
 */
export async function* runAutoBuild(
  artistId: string,
  _ownership: TurnOwnership,
): AsyncGenerator<TurnEvent> {
  yield { kind: "chat", text: NARRATION.building };
  const { provisionalSiteNames, discoveredBySiteName } = yield* autoBuildProfiles(artistId);
  yield* autoBuildSources(artistId, provisionalSiteNames, discoveredBySiteName);
  yield* emitVaultStep(artistId, false, true);
}
