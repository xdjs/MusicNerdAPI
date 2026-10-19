import { getOnboardingState } from "@/lib/onboarding/getOnboardingState";
import type { OnboardingStep } from "@/lib/onboarding/types";

/**
 * Where the claim build should start: the first unconfirmed onboarding step.
 *
 * @param artistId - The artist.
 * @returns That step, or null once the page is built.
 * @throws When the state can't be read, so the step retries.
 */
export async function readClaimBuildStep(artistId: string): Promise<OnboardingStep | null> {
  "use step";
  const state = await getOnboardingState(artistId);
  if (state === null) throw new Error("Onboarding state unavailable");
  return state.currentStep;
}
