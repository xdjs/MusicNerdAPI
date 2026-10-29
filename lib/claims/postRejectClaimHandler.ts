import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { setClaimStatus } from "@/lib/claims/setClaimStatus";
import { userLabel } from "@/lib/claims/userLabel";
import { validateClaimId } from "@/lib/claims/validateClaimId";
import { sendDiscordMessage } from "@/lib/discord/sendDiscordMessage";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/admin/claims/{id}/reject: rejects the claim and tells the
 * team. The rejected claim stays on record and no longer blocks a new claim.
 *
 * @param request - The request; an admin's Privy token.
 * @param id - The claim id from the path.
 * @returns 200 with `{ status }`; 400, 401, 403, 404 or 500 with `{ status: "error", error }`.
 */
export async function postRejectClaimHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const claimId = validateClaimId(id);
    if (claimId instanceof NextResponse) return claimId;
    const claim = await setClaimStatus(claimId, "rejected");
    if (!claim)
      return NextResponse.json(
        { status: "error", error: "Claim not found" },
        { status: 404, headers },
      );
    await sendDiscordMessage(
      `Claim REJECTED: ${claim.referenceCode} | Artist ID: ${claim.artistId} | Rejected by: ${await userLabel(auth.userId)}`,
    );
    return NextResponse.json({ status: "ok" }, { status: 200, headers });
  } catch (e) {
    console.error("[claims] reject error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
