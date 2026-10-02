import type { OnboardingStep, TurnContext } from "@/lib/onboarding/types";

/**
 * A turn context for tests.
 *
 * @param currentStep - The derived current step; null means complete.
 * @returns The context.
 */
export function turnContext(currentStep: OnboardingStep | null): TurnContext {
  return {
    artistId: "a1",
    ownership: { userId: "u1", expectedClaimId: "c1" },
    state: { complete: currentStep === null, currentStep },
  };
}
