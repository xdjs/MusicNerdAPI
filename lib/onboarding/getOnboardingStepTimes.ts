import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistOnboardingSteps } from "@/lib/db/schema";
import { ONBOARDING_STEPS } from "@/lib/onboarding/const";
import type { OnboardingStep } from "@/lib/onboarding/types";

/**
 * When each onboarding step was confirmed. Null means the read failed, which
 * callers must treat as unknown, never as an artist who hasn't started.
 *
 * @param artistId - The artist.
 * @returns Each step's confirmation time (ISO 8601, UTC) or null, or null on a database error.
 */
export async function getOnboardingStepTimes(
  artistId: string,
): Promise<Record<OnboardingStep, string | null> | null> {
  try {
    const rows = await db.query.artistOnboardingSteps.findMany({
      where: eq(artistOnboardingSteps.artistId, artistId),
    });
    const times = Object.fromEntries(ONBOARDING_STEPS.map(step => [step, null])) as Record<
      OnboardingStep,
      string | null
    >;
    for (const row of rows) {
      if (row.step in times && row.confirmedAt)
        times[row.step as OnboardingStep] = new Date(row.confirmedAt).toISOString();
    }
    return times;
  } catch (e) {
    console.error("[getOnboardingStepTimes] Error:", e);
    return null;
  }
}
