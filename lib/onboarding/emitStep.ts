import { emitInterviewStep } from "@/lib/onboarding/emitInterviewStep";
import { emitProfilesStep } from "@/lib/onboarding/emitProfilesStep";
import { emitPublishStep } from "@/lib/onboarding/emitPublishStep";
import { emitVaultStep } from "@/lib/onboarding/emitVaultStep";
import type { OnboardingStep, TurnEvent } from "@/lib/onboarding/types";

/**
 * The entry card for a step. Discovery runs only on a fresh entry into the
 * profiles step; a re-show after a failed confirm or a resync would otherwise
 * stack another ~25 s search on a turn that already did its writes.
 *
 * @param artistId - The artist.
 * @param step - The step.
 * @param opts - Flags.
 * @param opts.discoverProfiles - Search for missing profiles (profiles step).
 * @param opts.forceVaultDiscovery - Search the web even with sources pending (vault step).
 * @returns The step's events.
 */
export async function* emitStep(
  artistId: string,
  step: OnboardingStep,
  opts: { discoverProfiles?: boolean; forceVaultDiscovery?: boolean } = {},
): AsyncGenerator<TurnEvent> {
  if (step === "profiles") yield* emitProfilesStep(artistId, opts.discoverProfiles ?? false);
  else if (step === "vault") yield* emitVaultStep(artistId, opts.forceVaultDiscovery ?? false);
  else if (step === "interview") yield* emitInterviewStep(artistId);
  else yield* emitPublishStep(artistId);
}
