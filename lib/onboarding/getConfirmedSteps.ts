import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistOnboardingSteps } from "@/lib/db/schema";
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
  try {
    const rows = await db.query.artistOnboardingSteps.findMany({
      where: eq(artistOnboardingSteps.artistId, artistId),
    });
    return new Set(rows.map(r => r.step as OnboardingStep));
  } catch (e) {
    console.error("[getConfirmedSteps] Error:", e);
    return null;
  }
}
