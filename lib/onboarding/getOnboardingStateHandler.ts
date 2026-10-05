import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { firstUnconfirmedStep } from "@/lib/onboarding/firstUnconfirmedStep";
import { getOnboardingStepTimes } from "@/lib/onboarding/getOnboardingStepTimes";
import { validateOnboardingStateParams } from "@/lib/onboarding/validateOnboardingStateParams";

/**
 * Handles GET /api/onboarding/{artistId}/state: which onboarding steps are
 * confirmed and when. Public; the profile page polls it while the build runs.
 *
 * @param id - The artist id from the path.
 * @returns 200 with `{ status, complete, currentStep, steps }`, 400 for a bad id, or 503 when the state can't be read.
 */
export async function getOnboardingStateHandler(id: string): Promise<NextResponse> {
  const artistId = validateOnboardingStateParams(id);
  if (artistId instanceof NextResponse) return artistId;
  const headers = { ...getCorsHeaders(), "Cache-Control": "no-store" };
  const steps = await getOnboardingStepTimes(artistId);
  if (steps === null)
    return NextResponse.json(
      { status: "error", error: "Onboarding state unavailable" },
      { status: 503, headers },
    );
  const confirmed = new Set(
    Object.keys(steps).filter(step => steps[step as keyof typeof steps] !== null),
  );
  return NextResponse.json(
    {
      status: "ok",
      complete: steps.publish !== null,
      currentStep: firstUnconfirmedStep(confirmed),
      steps,
    },
    { status: 200, headers },
  );
}
