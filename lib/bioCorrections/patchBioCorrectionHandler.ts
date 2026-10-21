import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { reviewBioCorrection } from "@/lib/bioCorrections/reviewBioCorrection";
import { validateBioCorrectionReviewBody } from "@/lib/bioCorrections/validateBioCorrectionReviewBody";
import { validateReportId } from "@/lib/bioCorrections/validateReportId";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles PATCH /api/admin/bio-corrections/{id}: resolves or dismisses a
 * pending report.
 *
 * @param request - The request; an admin's Privy token and `{ status }`.
 * @param id - The report id from the path.
 * @returns 200 with `{ status, success }`; 400, 401, 403 or 409 with `{ status: "error", error }`.
 */
export async function patchBioCorrectionHandler(
  request: Request,
  id: string,
): Promise<NextResponse> {
  const headers = getCorsHeaders();
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const reportId = validateReportId(id);
  if (reportId instanceof NextResponse) return reportId;
  const body = await validateBioCorrectionReviewBody(request);
  if (body instanceof NextResponse) return body;
  if (!(await reviewBioCorrection(reportId, body.status, auth.userId)))
    return NextResponse.json(
      { status: "error", error: "Report was already reviewed or does not exist" },
      { status: 409, headers },
    );
  return NextResponse.json({ status: "ok", success: true }, { status: 200, headers });
}
