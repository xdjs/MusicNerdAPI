import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getClaimById } from "@/lib/claims/getClaimById";
import { revokeApprovedClaim } from "@/lib/claims/revokeApprovedClaim";
import { RevocationReviewRequiredError } from "@/lib/claims/RevocationReviewRequiredError";
import { userLabel } from "@/lib/claims/userLabel";
import { validateClaimId } from "@/lib/claims/validateClaimId";
import { sendDiscordMessage } from "@/lib/discord/sendDiscordMessage";
import { logMcpAudit } from "@/lib/mcp/logMcpAudit";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/** What the admin is told on success, as MusicNerdWeb tells them: stored files are kept. */
const REVOKED_WARNING =
  "Claim revoked. Uploaded files were retained; safe storage cleanup requires separate review.";

/**
 * Handles POST /api/admin/claims/{id}/revoke: deletes an approved claim and
 * what its claimant added while keeping verified trusted sources and stored
 * files, records the audit entry and tells the team, as MusicNerdWeb does.
 * The profile can then be claimed again.
 *
 * @param request - The request; an admin's Privy token.
 * @param id - The claim id from the path.
 * @returns 200 with `{ status, warning }`; 400, 401, 403, 404, 409 or 500 with `{ status: "error", error }`.
 */
export async function postRevokeClaimHandler(request: Request, id: string): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const error = (status: number, message: string) =>
    NextResponse.json({ status: "error", error: message }, { status, headers });
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const claimId = validateClaimId(id);
    if (claimId instanceof NextResponse) return claimId;
    const existing = await getClaimById(claimId);
    if (!existing) return error(404, "Claim not found");
    if (existing.status !== "approved") return error(409, "Can only revoke approved claims");
    let claim;
    try {
      claim = await revokeApprovedClaim(claimId, auth.userId);
    } catch (e) {
      if (e instanceof RevocationReviewRequiredError) return error(409, e.message);
      throw e;
    }
    if (!claim) return error(409, "Claim is no longer approved");
    // `admin:<userId>` marks an admin action in the audit log, apart from MCP key hashes.
    await logMcpAudit({
      artistId: claim.artistId,
      field: "claim",
      action: "delete",
      oldValue: `${claim.status}|${claim.referenceCode}`,
      newValue: null,
      apiKeyHash: `admin:${auth.userId}`,
    }).catch(e => console.error("[claims] Audit log failed:", e));
    await sendDiscordMessage(
      `Claim REVOKED: ${claim.referenceCode} | Artist ID: ${claim.artistId} | Revoked by: ${await userLabel(auth.userId)}`,
    );
    return NextResponse.json({ status: "ok", warning: REVOKED_WARNING }, { status: 200, headers });
  } catch (e) {
    console.error("[claims] revoke error", e);
    return error(500, "Internal server error");
  }
}
