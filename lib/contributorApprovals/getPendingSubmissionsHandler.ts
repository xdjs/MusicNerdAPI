import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { listPendingSubmissions } from "@/lib/contributorApprovals/listPendingSubmissions";
import { validateContributorId } from "@/lib/contributorApprovals/validateContributorId";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/admin/users/{id}/submissions: the contributor's pending submissions.
 *
 * @param request - The request; an admin's Privy token.
 * @param id - The contributor's user id from the path.
 * @returns 200 with `{ status, items, hasMore }`; 400, 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function getPendingSubmissionsHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const contributorId = validateContributorId(id);
    if (contributorId instanceof NextResponse) return contributorId;
    const result = await listPendingSubmissions(contributorId);
    return NextResponse.json({ status: "ok", ...result }, { status: 200, headers });
  } catch (e) {
    console.error("[admin/users/submissions] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
