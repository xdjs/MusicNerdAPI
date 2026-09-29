import { autoBuildAbout } from "@/lib/onboarding/autoBuildAbout";
import { autoBuildProfiles } from "@/lib/onboarding/autoBuildProfiles";
import { autoBuildSources } from "@/lib/onboarding/autoBuildSources";
import { NARRATION } from "@/lib/onboarding/const";
import type { TurnEvent, TurnOwnership } from "@/lib/onboarding/types";

/**
 * Builds the whole page for a fresh claim without asking anything: the claim
 * already established who they are. Every correction is recoverable on the
 * profile afterwards. Each stage confirms its own step, so a crash mid-build
 * resumes at the stage that failed, with the step-by-step cards.
 *
 * @param artistId - The artist.
 * @param ownership - The user and claim the turn runs under.
 * @returns The build's events.
 */
export async function* runAutoBuild(
  artistId: string,
  ownership: TurnOwnership,
): AsyncGenerator<TurnEvent> {
  yield { kind: "chat", text: NARRATION.building };
  const { provisionalSiteNames, discoveredBySiteName } = yield* autoBuildProfiles(artistId);
  const { citable } = yield* autoBuildSources(artistId, provisionalSiteNames, discoveredBySiteName);
  yield* autoBuildAbout(artistId, ownership, citable);
}
