import { firstUnconfirmedStep } from "@/lib/onboarding/firstUnconfirmedStep";
import { getConfirmedSteps } from "@/lib/onboarding/getConfirmedSteps";
import type { OnboardingState } from "@/lib/onboarding/types";

/**
 * Where the artist is in onboarding. Complete once publish is confirmed.
 *
 * @param artistId - The artist.
 * @returns The state, or null when it can't be read (callers act as if there's no onboarding).
 */
export async function getOnboardingState(artistId: string): Promise<OnboardingState | null> {
  const confirmed = await getConfirmedSteps(artistId);
  if (confirmed === null) return null;
  return { complete: confirmed.has("publish"), currentStep: firstUnconfirmedStep(confirmed) };
}
