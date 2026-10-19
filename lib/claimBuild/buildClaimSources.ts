import { drainBuildStage } from "@/lib/claimBuild/drainBuildStage";
import { autoBuildSources } from "@/lib/onboarding/autoBuildSources";
import type { TurnOwnership } from "@/lib/onboarding/types";

/**
 * Claim build step 2: search for sources, approve the pending ones and
 * confirm `vault`. The account choices the chat offered have no one to ask
 * here, so none are built.
 *
 * @param artistId - The artist.
 * @param ownership - The claimant and claim the build runs under.
 * @param provisionalSiteNames - The columns step 1 guessed; empty on a resume.
 */
export async function buildClaimSources(
  artistId: string,
  ownership: TurnOwnership,
  provisionalSiteNames: string[],
): Promise<void> {
  "use step";
  await drainBuildStage(
    artistId,
    ownership,
    autoBuildSources(artistId, provisionalSiteNames, new Map()),
  );
}
