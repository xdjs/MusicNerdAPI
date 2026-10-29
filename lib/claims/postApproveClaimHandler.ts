import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { setClaimStatus } from "@/lib/claims/setClaimStatus";
import { startClaimApprovalWork } from "@/lib/claims/startClaimApprovalWork";
import { userLabel } from "@/lib/claims/userLabel";
import { validateClaimId } from "@/lib/claims/validateClaimId";
import { sendDiscordMessage } from "@/lib/discord/sendDiscordMessage";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/admin/claims/{id}/approve: approves the claim, starts its
 * research, interview preparation and page build, and tells the team. The approval stands when follow-up work fails; the response
 * carries a warning instead.
 *
 * @param request - The request; an admin's Privy token.
 * @param id - The claim id from the path.
 * @returns 200 with `{ status, warning? }`; 400, 401, 403, 404 or 500 with `{ status: "error", error }`.
 */
export async function postApproveClaimHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const claimId = validateClaimId(id);
    if (claimId instanceof NextResponse) return claimId;
    const claim = await setClaimStatus(claimId, "approved");
    if (!claim)
      return NextResponse.json(
        { status: "error", error: "Claim not found" },
        { status: 404, headers },
      );
    const warning = await startClaimApprovalWork(claim, auth.userId);
    await sendDiscordMessage(
      `Claim APPROVED: ${claim.referenceCode} | Artist ID: ${claim.artistId} | Approved by: ${await userLabel(auth.userId)}`,
    );
    return NextResponse.json(
      { status: "ok", ...(warning ? { warning } : {}) },
      { status: 200, headers },
    );
  } catch (e) {
    console.error("[claims] approve error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
