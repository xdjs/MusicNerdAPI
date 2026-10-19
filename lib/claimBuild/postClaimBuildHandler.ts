import { startClaimBuild } from "@/lib/claimBuild/startClaimBuild";
import { db } from "@/lib/db/db";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { getOnboardingState } from "@/lib/onboarding/getOnboardingState";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { withResearchRequest } from "@/lib/questionResearch/withResearchRequest";

/**
 * Handles POST /api/onboarding/{artistId}/build: starts, or restarts, the
 * server-side claim build. MusicNerdWeb calls it with its research key when a
 * claim is approved; the claimant or an admin can call it to retry. Either
 * way the build runs as the approved claimant, under their claim.
 *
 * @param request - The request.
 * @param artistId - The artist id from the path.
 * @returns 200 with `{ status, started, runId }`; 400, 401, 403, 409 without an approved claim, or 503.
 */
export async function postClaimBuildHandler(request: Request, artistId: string) {
  return withResearchRequest(request, artistId, false, async () => {
    const claim = await findApprovedClaim(db, artistId);
    if (!claim) throw new KnowledgeError("no_claim", 409, "No approved claim");
    const state = await getOnboardingState(artistId);
    if (state?.complete) return { status: "ok", started: false, runId: null };
    const runId = await startClaimBuild(artistId, {
      userId: claim.userId,
      expectedClaimId: claim.id,
    });
    return { status: "ok", started: true, runId };
  });
}
