import { start } from "workflow/api";
import { claimBuildWorkflow } from "@/lib/claimBuild/claimBuildWorkflow";
import type { TurnOwnership } from "@/lib/onboarding/types";

/**
 * Starts the claim build workflow and returns without waiting for it.
 *
 * @param artistId - The artist.
 * @param ownership - The approved claimant and their claim.
 * @returns The run's ID.
 */
export async function startClaimBuild(artistId: string, ownership: TurnOwnership): Promise<string> {
  const run = await start(claimBuildWorkflow, [artistId, ownership]);
  return run.runId;
}
