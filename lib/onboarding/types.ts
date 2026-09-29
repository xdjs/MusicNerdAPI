import type { ONBOARDING_QUESTIONS, ONBOARDING_STEPS } from "@/lib/onboarding/const";

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingState = { complete: boolean; currentStep: OnboardingStep | null };

export type OnboardingQuestionKey = (typeof ONBOARDING_QUESTIONS)[number]["key"];

/** "offered" is a question put to the artist and not yet dealt with: the boundary of a
 *  sitting. It becomes "followup" once they answer or skip it. */
export type InterviewAnswerSource = "onboarding" | "followup" | "offered";
