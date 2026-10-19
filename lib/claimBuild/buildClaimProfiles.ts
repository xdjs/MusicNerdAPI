import { drainBuildStage } from "@/lib/claimBuild/drainBuildStage";
import { autoBuildProfiles } from "@/lib/onboarding/autoBuildProfiles";
import type { TurnOwnership } from "@/lib/onboarding/types";

/**
 * Claim build step 1: find the artist's profiles, link them and confirm
 * `profiles`.
 *
 * @param artistId - The artist.
 * @param ownership - The claimant and claim the build runs under.
 * @returns The columns it filled with a guess, for the source search to replace.
 */
export async function buildClaimProfiles(
  artistId: string,
  ownership: TurnOwnership,
): Promise<string[]> {
  "use step";
  const { provisionalSiteNames } = await drainBuildStage(
    artistId,
    ownership,
    autoBuildProfiles(artistId),
  );
  return provisionalSiteNames;
}
