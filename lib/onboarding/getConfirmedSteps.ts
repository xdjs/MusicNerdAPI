import { getOnboardingStepTimes } from "@/lib/onboarding/getOnboardingStepTimes";
import type { OnboardingStep } from "@/lib/onboarding/types";

/**
 * The onboarding steps the artist has confirmed. Null means the read failed,
 * which callers must treat as unknown, never as a new claimant starting at
 * profiles: conflating the two fails open into a stuck takeover.
 *
 * @param artistId - The artist.
 * @returns The confirmed steps, or null on a database error.
 */
export async function getConfirmedSteps(artistId: string): Promise<Set<OnboardingStep> | null> {
  const times = await getOnboardingStepTimes(artistId);
  if (times === null) return null;
  return new Set((Object.keys(times) as OnboardingStep[]).filter(step => times[step] !== null));
}
