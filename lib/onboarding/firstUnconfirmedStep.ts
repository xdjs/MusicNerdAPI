import { ONBOARDING_STEPS } from "@/lib/onboarding/const";
import type { OnboardingStep } from "@/lib/onboarding/types";

/**
 * The step the artist is on: the first one in order without a confirmation.
 *
 * @param confirmed - The confirmed steps.
 * @returns The current step, or null when every step is confirmed.
 */
export function firstUnconfirmedStep(confirmed: ReadonlySet<string>): OnboardingStep | null {
  for (const step of ONBOARDING_STEPS) {
    if (!confirmed.has(step)) return step;
  }
  return null;
}
