import { NextResponse } from "next/server";
import { getAdminReviewQueue } from "@/lib/adminReview/getAdminReviewQueue";
import { validateReviewQueueQuery } from "@/lib/adminReview/validateReviewQueueQuery";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/admin/review-queue: one page of pending links, sources and
 * About corrections. Admin only.
 *
 * @param request - The request; an admin's Privy token and optional `type`, `query`, `page`.
 * @returns 200 with `{ status, items, counts, pendingCounts, total, page, pageSize, filters }`; 401, 403 or 500.
 */
export async function getAdminReviewQueueHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const queue = await getAdminReviewQueue(validateReviewQueueQuery(request));
    return NextResponse.json({ status: "ok", ...queue }, { headers });
  } catch (e) {
    console.error("[admin/review-queue] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
