import { createHook } from "workflow";
import { buildClaimAbout } from "@/lib/claimBuild/buildClaimAbout";
import { buildClaimProfiles } from "@/lib/claimBuild/buildClaimProfiles";
import { buildClaimSources } from "@/lib/claimBuild/buildClaimSources";
import { readClaimBuildStep } from "@/lib/claimBuild/readClaimBuildStep";
import type { TurnOwnership } from "@/lib/onboarding/types";

/**
 * Builds a claimed artist's page on the server, start to finish, with nobody
 * on it. Each stage is a retried step that confirms its own onboarding step,
 * so a run started after a failure resumes at the first unconfirmed one. The
 * hook token keeps one build per artist: a second run while one is going
 * leaves it alone.
 *
 * @param artistId - The artist.
 * @param ownership - The approved claimant and their claim.
 * @returns Whether this run built anything, and the run already building when it didn't.
 */
export async function claimBuildWorkflow(
  artistId: string,
  ownership: TurnOwnership,
): Promise<{ built: boolean; runningIn?: string }> {
  "use workflow";
  using building = createHook({ token: `claim-build:${artistId}` });
  const running = await building.getConflict();
  if (running) return { built: false, runningIn: running.runId };

  const step = await readClaimBuildStep(artistId);
  if (step === null) return { built: false };
  if (step === "profiles" || step === "vault") {
    const guessed = step === "profiles" ? await buildClaimProfiles(artistId, ownership) : [];
    await buildClaimSources(artistId, ownership, guessed);
  }
  await buildClaimAbout(artistId, ownership);
  return { built: true };
}
