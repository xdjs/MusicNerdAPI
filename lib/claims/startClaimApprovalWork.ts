import { startClaimBuild } from "@/lib/claimBuild/startClaimBuild";
import { queueClaimInterview } from "@/lib/claims/queueClaimInterview";
import { queueClaimSourceSearch } from "@/lib/claims/queueClaimSourceSearch";
import { hasReusableDirectoryDiscovery } from "@/lib/directoryPreparation/hasReusableDirectoryDiscovery";
import { getOnboardingState } from "@/lib/onboarding/getOnboardingState";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";

/**
 * Starts the work an approval sets off: source research (unless directory
 * discovery already did it), private interview preparation, and the page
 * build. Research and preparation run as the approving admin; the build runs
 * as the claimant. The approval has committed, so a failure here only warns.
 *
 * @param claim - The approved claim.
 * @param claim.id - The claim.
 * @param claim.artistId - The artist.
 * @param claim.userId - The claimant.
 * @param adminUserId - The approving admin.
 * @returns The warning to show the admin, or undefined when everything started.
 */
export async function startClaimApprovalWork(
  claim: { id: string; artistId: string; userId: string },
  adminUserId: string,
): Promise<string | undefined> {
  const ownership = { userId: adminUserId, expectedClaimId: claim.id, trigger: "claim_approval" };
  let researchReady = await hasReusableDirectoryDiscovery(claim.artistId, claim.id);
  if (!researchReady) {
    try {
      researchReady = await withArtistOperation(claim.artistId, ownership, () =>
        queueClaimSourceSearch(claim.artistId, claim.id),
      );
    } catch (error) {
      console.error("[claims] Source research enqueue failed:", error);
    }
  }
  let interviewReady = true;
  try {
    interviewReady = await withArtistOperation(claim.artistId, ownership, () =>
      queueClaimInterview(claim.artistId, claim.id, claim.userId),
    );
  } catch (error) {
    interviewReady = false;
    console.error("[claims] Interview preparation enqueue failed:", error);
  }
  let buildStarted = false;
  try {
    const state = await getOnboardingState(claim.artistId);
    if (!state?.complete)
      await startClaimBuild(claim.artistId, { userId: claim.userId, expectedClaimId: claim.id });
    buildStarted = true;
  } catch (error) {
    console.error("[claims] Page build start failed:", error);
  }
  if (!researchReady)
    return "Claim approved, but source research could not be queued. Open the artist’s Lore and use “Search web for sources” to retry.";
  if (!interviewReady)
    return "Claim approved, but interview preparation could not be queued. The artist can still prepare an interview from their profile.";
  if (!buildStarted)
    return "Claim approved, but the page build could not start. It restarts when the artist taps “Try again” on their page.";
  return undefined;
}
