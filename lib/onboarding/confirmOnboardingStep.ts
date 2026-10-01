import { artistOnboardingSteps } from "@/lib/db/schema";
import type { OnboardingStep } from "@/lib/onboarding/types";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";

/**
 * Confirms an onboarding step. Written only by an explicit artist action;
 * idempotent, so a second tab confirming the same step is harmless.
 *
 * @param artistId - The artist.
 * @param step - The step.
 * @returns Nothing; a changed claim throws.
 */
export async function confirmOnboardingStep(artistId: string, step: OnboardingStep): Promise<void> {
  await withScopedArtistWrite(artistId, async tx => {
    await tx
      .insert(artistOnboardingSteps)
      .values({ artistId, step })
      .onConflictDoNothing({
        target: [artistOnboardingSteps.artistId, artistOnboardingSteps.step],
      });
  });
}
