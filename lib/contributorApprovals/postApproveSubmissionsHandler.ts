import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { approveContributorSubmissions } from "@/lib/contributorApprovals/approveContributorSubmissions";
import { validateApproveSubmissionsBody } from "@/lib/contributorApprovals/validateApproveSubmissionsBody";
import { validateContributorId } from "@/lib/contributorApprovals/validateContributorId";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/admin/users/{id}/submissions/approve: approves up to 10 of
 * the contributor's pending submissions as the calling admin.
 *
 * @param request - The request; an admin's Privy token and `{ items }`.
 * @param id - The contributor's user id from the path.
 * @returns 200 with `{ status, approved, skipped, failed, warning? }`; 400, 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function postApproveSubmissionsHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const contributorId = validateContributorId(id);
    if (contributorId instanceof NextResponse) return contributorId;
    const body = await validateApproveSubmissionsBody(request);
    if (body instanceof NextResponse) return body;
    const result = await approveContributorSubmissions(auth.userId, contributorId, body.items);
    return NextResponse.json({ status: "ok", ...result }, { status: 200, headers });
  } catch (e) {
    console.error("[admin/users/submissions] approve error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
