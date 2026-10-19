import { drainBuildStage } from "@/lib/claimBuild/drainBuildStage";
import { autoBuildAbout } from "@/lib/onboarding/autoBuildAbout";
import type { TurnOwnership } from "@/lib/onboarding/types";

/**
 * Claim build step 3: write the Lore and the About and publish them, which
 * confirms `interview` and `publish`.
 *
 * @param artistId - The artist.
 * @param ownership - The claimant and claim the build runs under.
 */
export async function buildClaimAbout(artistId: string, ownership: TurnOwnership): Promise<void> {
  "use step";
  // The source count only picks the chat's closing line, which nobody reads here.
  await drainBuildStage(artistId, ownership, autoBuildAbout(artistId, ownership, 0));
}
